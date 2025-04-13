// src/database/DatabaseMigrationService.ts

import { 
  Database,
  ref,
  get,
  set,
  update
} from 'firebase/database';
import { DatabaseManager } from './DatabaseManager';

interface MigrationMetadata {
  version: number;
  timestamp: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

interface Migration {
  version: number;
  description: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

export class DatabaseMigrationService {
  private static instance: DatabaseMigrationService;
  private database: Database;
  private migrations: Migration[] = [];

  private constructor() {
    this.database = DatabaseManager.getInstance().getDatabaseInstance();
    this.registerMigrations();
  }

  public static getInstance(): DatabaseMigrationService {
    if (!DatabaseMigrationService.instance) {
      DatabaseMigrationService.instance = new DatabaseMigrationService();
    }
    return DatabaseMigrationService.instance;
  }

  private registerMigrations(): void {
    // Register all migrations in order
    this.addMigration({
      version: 1,
      description: 'Initial schema setup',
      up: async (db: Database) => {
        const updates: Record<string, any> = {
          'hosts': {
            '.indexOn': ['status', 'subscriptionEnd']
          },
          'schemaVersion': 1
        };
        await this.updateDatabaseStructure(updates);
      },
      down: async (db: Database) => {
        // Revert to initial state
        await set(ref(db, '/'), null);
      }
    });

    this.addMigration({
      version: 2,
      description: 'Add game history tracking',
      up: async (db: Database) => {
        const updates = {
          'hosts': {
            '$hostId': {
              'gameHistory': {
                '.indexOn': ['startTime', 'endTime']
              }
            }
          }
        };
        await this.updateDatabaseStructure(updates);
      },
      down: async (db: Database) => {
        const hosts = await get(ref(db, 'hosts'));
        const updates: Record<string, null> = {};
        
        hosts.forEach(host => {
          updates[`hosts/${host.key}/gameHistory`] = null;
        });
        
        await update(ref(db), updates);
      }
    });

    // Add more migrations as needed
  }

  private addMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  private async updateDatabaseStructure(updates: Record<string, any>): Promise<void> {
    try {
      const rulesRef = ref(this.database, '.settings/rules');
      await update(rulesRef, updates);
    } catch (error) {
      console.error('Failed to update database structure:', error);
      throw error;
    }
  }

  public async getCurrentVersion(): Promise<number> {
    try {
      const versionRef = ref(this.database, 'schemaVersion');
      const snapshot = await get(versionRef);
      return snapshot.val() || 0;
    } catch (error) {
      console.error('Failed to get current version:', error);
      return 0;
    }
  }

  public async migrate(targetVersion?: number): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const maxVersion = Math.max(...this.migrations.map(m => m.version));
    targetVersion = targetVersion || maxVersion;

    if (currentVersion === targetVersion) {
      console.log('Database is already at target version');
      return;
    }

    const isUpgrade = targetVersion > currentVersion;
    const migrations = this.migrations
      .filter(m => isUpgrade
        ? m.version > currentVersion && m.version <= targetVersion
        : m.version <= currentVersion && m.version > targetVersion
      )
      .sort((a, b) => isUpgrade ? a.version - b.version : b.version - a.version);

    for (const migration of migrations) {
      await this.executeMigration(migration, isUpgrade);
    }
  }

  private async executeMigration(
    migration: Migration,
    isUpgrade: boolean
  ): Promise<void> {
    const metadata: MigrationMetadata = {
      version: migration.version,
      timestamp: Date.now(),
      description: migration.description,
      status: 'pending'
    };

    try {
      // Record migration start
      await this.updateMigrationMetadata(metadata);

      // Execute migration
      if (isUpgrade) {
        await migration.up(this.database);
      } else {
        await migration.down(this.database);
      }

      // Update schema version and status
      await set(ref(this.database, 'schemaVersion'), 
        isUpgrade ? migration.version : migration.version - 1
      );

      metadata.status = 'completed';
      await this.updateMigrationMetadata(metadata);

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      await this.updateMigrationMetadata(metadata);
      
      // Log migration failure
      console.error(`Migration ${migration.version} failed:`, error);
      
      // Create recovery checkpoint
      await this.createRecoveryCheckpoint(migration.version);
      
      throw new Error(`Migration ${migration.version} failed: ${metadata.error}`);
    }
  }

  private async createRecoveryCheckpoint(version: number): Promise<void> {
    try {
      const checkpointRef = ref(this.database, `migrationCheckpoints/${version}`);
      const checkpoint = {
        version,
        timestamp: Date.now(),
        databaseState: await this.captureCurrentState()
      };
      await set(checkpointRef, checkpoint);
    } catch (error) {
      console.error('Failed to create recovery checkpoint:', error);
      // Continue without checkpoint - don't throw as this is a recovery mechanism
    }
  }

  private async captureCurrentState(): Promise<any> {
    try {
      const rootRef = ref(this.database, '/');
      const snapshot = await get(rootRef);
      return snapshot.val();
    } catch (error) {
      console.error('Failed to capture database state:', error);
      return null;
    }
  }

  public async recoverFromCheckpoint(version: number): Promise<void> {
    try {
      const checkpointRef = ref(this.database, `migrationCheckpoints/${version}`);
      const snapshot = await get(checkpointRef);

      if (!snapshot.exists()) {
        throw new Error(`No recovery checkpoint found for version ${version}`);
      }

      const checkpoint = snapshot.val();
      
      // Restore database state
      await set(ref(this.database, '/'), checkpoint.databaseState);
      
      // Update schema version
      await set(ref(this.database, 'schemaVersion'), version - 1);
      
      // Clear the failed migration metadata
      await this.updateMigrationMetadata({
        version,
        timestamp: Date.now(),
        description: 'Migration recovered from checkpoint',
        status: 'pending'
      });
    } catch (error) {
      console.error('Failed to recover from checkpoint:', error);
      throw new Error(`Recovery failed for version ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getMigrationStatus(version: number): Promise<MigrationMetadata | null> {
    try {
      const metadataRef = ref(this.database, `migrations/${version}`);
      const snapshot = await get(metadataRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Failed to get migration status:', error);
      return null;
    }
  }

  // Implementation of the previously missing methods
  public async updateMigrationMetadata(metadata: MigrationMetadata): Promise<void> {
    if (!metadata.version) {
      throw new Error('Migration metadata must include a version');
    }
    
    try {
      const metadataRef = ref(this.database, `migrations/${metadata.version}`);
      await set(metadataRef, { 
        ...metadata,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error updating migration metadata:', error);
      throw new Error(`Failed to update migration metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  public async validateSchema(): Promise<boolean> {
    try {
      // Perform schema validation checks here
      // This is a simplified version that just returns true
      const version = await this.getCurrentVersion();
      return version > 0; // Schema exists if version is greater than 0
    } catch (error) {
      console.error('Schema validation failed:', error);
      return false;
    }
  }
}