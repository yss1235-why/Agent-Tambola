// src/utils/audioManager.ts

import { Game } from '../types/game';

interface NumberCall {
  phrase: string;
  description: string;
}

// Number calls dictionary
const numberCalls: Record<number, NumberCall> = {
  1: { phrase: "Kelly's Eye", description: "Number 1" },
  2: { phrase: "One Little Duck", description: "Number 2" },
  3: { phrase: "Cup of Tea", description: "Number 3" },
  4: { phrase: "Knock at the Door", description: "Number 4" },
  5: { phrase: "Man Alive", description: "Number 5" },
  6: { phrase: "Half a Dozen", description: "Number 6" },
  7: { phrase: "Lucky Seven", description: "Number 7" },
  8: { phrase: "Garden Gate", description: "Number 8" },
  9: { phrase: "Doctor's Orders", description: "Number 9" },
  10: { phrase: "Cameron's Den", description: "Number 10" },
  11: { phrase: "Legs Eleven", description: "Number 11" },
  12: { phrase: "One Dozen", description: "Number 12" },
  13: { phrase: "Unlucky for Some", description: "Number 13" },
  14: { phrase: "Valentine's Day", description: "Number 14" },
  15: { phrase: "Young and Keen", description: "Number 15" },
  16: { phrase: "Sweet Sixteen", description: "Number 16" },
  17: { phrase: "Dancing Queen", description: "Number 17" },
  18: { phrase: "Coming of Age", description: "Number 18" },
  19: { phrase: "Goodbye Teens", description: "Number 19" },
  20: { phrase: "One Score", description: "Number 20" },
  21: { phrase: "Key of the Door", description: "Number 21" },
  22: { phrase: "Two Little Ducks", description: "Number 22" },
  23: { phrase: "Thee and Me", description: "Number 23" },
  24: { phrase: "Two Dozen", description: "Number 24" },
  25: { phrase: "Duck and Dive", description: "Number 25" },
  26: { phrase: "Half a Crown", description: "Number 26" },
  27: { phrase: "Duck and a Crutch", description: "Number 27" },
  28: { phrase: "In a State", description: "Number 28" },
  29: { phrase: "Rise and Shine", description: "Number 29" },
  30: { phrase: "Dirty Gertie", description: "Number 30" },
  31: { phrase: "Get Up and Run", description: "Number 31" },
  32: { phrase: "Buckle My Shoe", description: "Number 32" },
  33: { phrase: "All the Threes", description: "Number 33" },
  34: { phrase: "Ask for More", description: "Number 34" },
  35: { phrase: "Jump and Jive", description: "Number 35" },
  36: { phrase: "Three Dozen", description: "Number 36" },
  37: { phrase: "More than Eleven", description: "Number 37" },
  38: { phrase: "Christmas Cake", description: "Number 38" },
  39: { phrase: "Steps", description: "Number 39" },
  40: { phrase: "Life Begins", description: "Number 40" },
  41: { phrase: "Time for Fun", description: "Number 41" },
  42: { phrase: "Winnie the Pooh", description: "Number 42" },
  43: { phrase: "Down on Your Knees", description: "Number 43" },
  44: { phrase: "Droopy Drawers", description: "Number 44" },
  45: { phrase: "Halfway There", description: "Number 45" },
  46: { phrase: "Up to Tricks", description: "Number 46" },
  47: { phrase: "Four and Seven", description: "Number 47" },
  48: { phrase: "Four Dozen", description: "Number 48" },
  49: { phrase: "PC", description: "Number 49" },
  50: { phrase: "Half a Century", description: "Number 50" },
  51: { phrase: "Tweak of the Thumb", description: "Number 51" },
  52: { phrase: "Danny La Rue", description: "Number 52" },
  53: { phrase: "Stuck in the Tree", description: "Number 53" },
  54: { phrase: "Clean the Floor", description: "Number 54" },
  55: { phrase: "Snakes Alive", description: "Number 55" },
  56: { phrase: "Was She Worth It", description: "Number 56" },
  57: { phrase: "Heinz Variety", description: "Number 57" },
  58: { phrase: "Make Them Wait", description: "Number 58" },
  59: { phrase: "Brighton Line", description: "Number 59" },
  60: { phrase: "Five Dozen", description: "Number 60" },
  61: { phrase: "Baker's Bun", description: "Number 61" },
  62: { phrase: "Turn the Screw", description: "Number 62" },
  63: { phrase: "Tickle Me", description: "Number 63" },
  64: { phrase: "Red Raw", description: "Number 64" },
  65: { phrase: "Old Age Pension", description: "Number 65" },
  66: { phrase: "Clickety Click", description: "Number 66" },
  67: { phrase: "Stairway to Heaven", description: "Number 67" },
  68: { phrase: "Saving Grace", description: "Number 68" },
  69: { phrase: "Either Way Up", description: "Number 69" },
  70: { phrase: "Three Score and Ten", description: "Number 70" },
  71: { phrase: "Bang on the Drum", description: "Number 71" },
  72: { phrase: "Six Dozen", description: "Number 72" },
  73: { phrase: "Queen Bee", description: "Number 73" },
  74: { phrase: "Hit the Floor", description: "Number 74" },
  75: { phrase: "Strive and Strive", description: "Number 75" },
  76: { phrase: "Trombones", description: "Number 76" },
  77: { phrase: "Sunset Strip", description: "Number 77" },
  78: { phrase: "Heaven's Gate", description: "Number 78" },
  79: { phrase: "One More Time", description: "Number 79" },
  80: { phrase: "Gandhi's Breakfast", description: "Number 80" },
  81: { phrase: "Fat Lady with a Walking Stick", description: "Number 81" },
  82: { phrase: "Straight On Through", description: "Number 82" },
  83: { phrase: "Time for Tea", description: "Number 83" },
  84: { phrase: "Seven Dozen", description: "Number 84" },
  85: { phrase: "Staying Alive", description: "Number 85" },
  86: { phrase: "Between the Sticks", description: "Number 86" },
  87: { phrase: "Torquay in Devon", description: "Number 87" },
  88: { phrase: "Two Fat Ladies", description: "Number 88" },
  89: { phrase: "Nearly There", description: "Number 89" },
  90: { phrase: "Top of the Shop", description: "Number 90" }
};

interface AudioSettings {
  volume: number;
  rate: number;
  pitch: number;
  language: string;
  useCustomAudio: boolean;
  callDelay: number;
}

export class AudioManager {
  private static instance: AudioManager;
  private settings: AudioSettings;
  private synthesizer: SpeechSynthesis;
  private audioContext: AudioContext | null;
  private isPlaying: boolean;
  private queue: Array<() => Promise<void>>;
  
  private constructor() {
    this.settings = {
      volume: 1.0,
      rate: 0.9,
      pitch: 1.0,
      language: 'en-US',
      useCustomAudio: true,
      callDelay: 5000
    };
    
    this.synthesizer = window.speechSynthesis;
    this.audioContext = null;
    this.isPlaying = false;
    this.queue = [];
    
    // Initialize Web Audio API context on user interaction
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        this.initializeAudioContext();
      }
    }, { once: true });
  }
  
  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Could not create AudioContext:', error);
    }
  }
  
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  public initialize(): Promise<void> {
    return new Promise((resolve) => {
      // Pre-warm the speech synthesis
      this.synthesizer.cancel();
      
      // Try to create AudioContext early
      try {
        this.initializeAudioContext();
      } catch (error) {
        console.warn('AudioContext creation deferred until user interaction');
      }
      
      resolve();
    });
  }
  
  // Modified to start announcement without blocking the flow
  public announceNumber(number: number): Promise<void> {
    // Start the announcement but don't wait for it to complete
    this.doAnnounceNumber(number).catch(error => {
      console.error('Error in background number announcement:', error);
    });
    
    // Return a resolved promise immediately
    return Promise.resolve();
  }
  
  // For cases where waiting for the completion is necessary
  public announceNumberAndWait(number: number): Promise<void> {
    return this.doAnnounceNumber(number);
  }
  
  private async doAnnounceNumber(number: number): Promise<void> {
    this.isPlaying = true;
    
    return new Promise<void>((resolve) => {
      let text = number.toString();
      
      // Use phrase if available and custom audio enabled
      if (this.settings.useCustomAudio && numberCalls[number]) {
        text = `${number}. ${numberCalls[number].phrase}, ${numberCalls[number].description}`;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply settings
      utterance.volume = this.settings.volume;
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.lang = this.settings.language;
      
      utterance.onend = () => {
        this.isPlaying = false;
        
        // Process queue
        if (this.queue.length > 0) {
          const nextAnnouncement = this.queue.shift();
          if (nextAnnouncement) {
            nextAnnouncement().catch(error => {
              console.error('Error processing queued announcement:', error);
            });
          }
        }
        
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.isPlaying = false;
        resolve();
      };
      
      this.synthesizer.speak(utterance);
    });
  }
  
  // Modified to avoid blocking when possible
  public async playEffect(effectName: string): Promise<void> {
    // Check if it's a prize win effect
    const prizeWinMatch = effectName.match(/^(quickFive|topLine|middleLine|bottomLine|corners|starCorners|halfSheet|fullSheet|fullHouse|secondFullHouse)Win$/);
    
    if (prizeWinMatch) {
      // Don't wait for completion
      this.playPrizeWinEffect(prizeWinMatch[1] as keyof Game.Winners).catch(error => {
        console.error('Error playing prize win effect:', error);
      });
      return Promise.resolve();
    }
    
    // Otherwise, start the sound without waiting
    let soundType: 'success' | 'error' | 'notification' = 'notification';
    
    if (effectName.includes('Win')) {
      soundType = 'success';
    } else if (effectName.includes('Error')) {
      soundType = 'error';
    }
    
    this.playSound(soundType).catch(error => {
      console.error('Error playing sound effect:', error);
    });
    return Promise.resolve();
  }

  public async playPrizeWinEffect(prizeType: keyof Game.Winners): Promise<void> {
    if (!this.audioContext) {
      this.initializeAudioContext();
      if (!this.audioContext) {
        return Promise.resolve();
      }
    }
    
    return new Promise((resolve) => {
      // Configure different sounds for different prize types
      let pattern: number[][] = []; // frequency and duration pairs
      
      // Configure distinctive patterns for each prize type
      switch (prizeType) {
        case 'quickFive':
          pattern = [[440, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [880, 0.3]];
          break;
        case 'topLine':
        case 'middleLine':
        case 'bottomLine':
          pattern = [[440, 0.1], [523, 0.1], [659, 0.3]];
          break;
        case 'corners':
        case 'starCorners':
          pattern = [[523, 0.1], [659, 0.1], [784, 0.1], [880, 0.3]];
          break;
        case 'halfSheet':
          pattern = [[440, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [880, 0.1], [1047, 0.3]];
          break;
        case 'fullSheet':
          pattern = [[523, 0.1], [659, 0.1], [784, 0.1], [880, 0.1], [1047, 0.1], [1319, 0.3]];
          break;
        case 'fullHouse':
          pattern = [[440, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [880, 0.1], [1047, 0.1], [1319, 0.3]];
          break;
        case 'secondFullHouse':
          pattern = [[1319, 0.1], [1047, 0.1], [880, 0.1], [784, 0.1], [659, 0.1], [523, 0.1], [440, 0.3]];
          break;
        default:
          // Default celebratory pattern
          pattern = [[440, 0.1], [659, 0.1], [880, 0.3]];
      }
      
      // Create a sequence of oscillators for the pattern
      let startTime = this.audioContext!.currentTime;
      
      pattern.forEach(([freq, dur]) => {
        const oscillator = this.audioContext!.createOscillator();
        const gainNode = this.audioContext!.createGain();
        
        oscillator.frequency.value = freq;
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext!.destination);
        
        // Apply volume setting and envelope
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2 * this.settings.volume, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + dur);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + dur);
        
        startTime += dur;
      });
      
      // Add a bit of extra time to ensure playback completes
      setTimeout(resolve, (startTime - this.audioContext!.currentTime) * 1000 + 100);
    });
  }
  
  public async playSound(soundType: 'success' | 'error' | 'notification'): Promise<void> {
    if (!this.audioContext) {
      this.initializeAudioContext();
      if (!this.audioContext) {
        return Promise.resolve();
      }
    }
    
    return new Promise((resolve) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      // Configure sound based on type
      switch (soundType) {
        case 'success':
          oscillator.frequency.setValueAtTime(880, this.audioContext!.currentTime); // A5
          gainNode.gain.setValueAtTime(0.1 * this.settings.volume, this.audioContext!.currentTime);
          oscillator.start();
          oscillator.stop(this.audioContext!.currentTime + 0.2);
          break;
          
        case 'error':
          oscillator.frequency.setValueAtTime(220, this.audioContext!.currentTime); // A3
          gainNode.gain.setValueAtTime(0.1 * this.settings.volume, this.audioContext!.currentTime);
          oscillator.start();
          oscillator.stop(this.audioContext!.currentTime + 0.3);
          break;
          
        case 'notification':
          oscillator.frequency.setValueAtTime(440, this.audioContext!.currentTime); // A4
          gainNode.gain.setValueAtTime(0.1 * this.settings.volume, this.audioContext!.currentTime);
          oscillator.start();
          oscillator.stop(this.audioContext!.currentTime + 0.1);
          break;
      }
      
      setTimeout(resolve, 300);
    });
  }
  
  public getNumberCall(number: number): NumberCall | undefined {
    return numberCalls[number];
  }
  
  public formatNumberCall(number: number): string {
    const call = numberCalls[number];
    return call ? `${call.phrase}, ${call.description}` : `Number ${number}`;
  }
  
  public getAnnouncementText(number: number): string {
    const call = numberCalls[number];
    return call ? `${number}. ${call.phrase}, ${call.description}` : `Number ${number}`;
  }
  
  public updateSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
  
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }
  
  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
  }
  
  public setRate(rate: number): void {
    this.settings.rate = Math.max(0.1, Math.min(2, rate));
  }
  
  public setPitch(pitch: number): void {
    this.settings.pitch = Math.max(0.1, Math.min(2, pitch));
  }
  
  public setLanguage(language: string): void {
    this.settings.language = language;
  }
  
  public isSpeaking(): boolean {
    return this.isPlaying;
  }
  
  public cancelSpeech(): void {
    this.synthesizer.cancel();
    this.queue = [];
    this.isPlaying = false;
  }
  
  public pauseSpeech(): void {
    this.synthesizer.pause();
  }
  
  public resumeSpeech(): void {
    this.synthesizer.resume();
  }
}

export default AudioManager;