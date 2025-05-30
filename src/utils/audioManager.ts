// src/utils/audioManager.ts - Simplified and consolidated version

import { Game } from '../types/game';

interface AudioSettings {
  volume: number;
  rate: number;
  pitch: number;
  language: string;
  useCustomAudio: boolean;
  enabled: boolean;
}

const numberCalls: Record<number, string> = {
  1: "Kelly's Eye", 2: "One Little Duck", 3: "Cup of Tea", 4: "Knock at the Door",
  5: "Man Alive", 6: "Half a Dozen", 7: "Lucky Seven", 8: "Garden Gate",
  9: "Doctor's Orders", 10: "Cameron's Den", 11: "Legs Eleven", 12: "One Dozen",
  13: "Unlucky for Some", 14: "Valentine's Day", 15: "Young and Keen", 16: "Sweet Sixteen",
  17: "Dancing Queen", 18: "Coming of Age", 19: "Goodbye Teens", 20: "One Score",
  21: "Key of the Door", 22: "Two Little Ducks", 23: "Thee and Me", 24: "Two Dozen",
  25: "Duck and Dive", 26: "Half a Crown", 27: "Duck and a Crutch", 28: "In a State",
  29: "Rise and Shine", 30: "Dirty Gertie", 31: "Get Up and Run", 32: "Buckle My Shoe",
  33: "All the Threes", 34: "Ask for More", 35: "Jump and Jive", 36: "Three Dozen",
  37: "More than Eleven", 38: "Christmas Cake", 39: "Steps", 40: "Life Begins",
  41: "Time for Fun", 42: "Winnie the Pooh", 43: "Down on Your Knees", 44: "Droopy Drawers",
  45: "Halfway There", 46: "Up to Tricks", 47: "Four and Seven", 48: "Four Dozen",
  49: "PC", 50: "Half a Century", 51: "Tweak of the Thumb", 52: "Danny La Rue",
  53: "Stuck in the Tree", 54: "Clean the Floor", 55: "Snakes Alive", 56: "Was She Worth It",
  57: "Heinz Variety", 58: "Make Them Wait", 59: "Brighton Line", 60: "Five Dozen",
  61: "Baker's Bun", 62: "Turn the Screw", 63: "Tickle Me", 64: "Red Raw",
  65: "Old Age Pension", 66: "Clickety Click", 67: "Stairway to Heaven", 68: "Saving Grace",
  69: "Either Way Up", 70: "Three Score and Ten", 71: "Bang on the Drum", 72: "Six Dozen",
  73: "Queen Bee", 74: "Hit the Floor", 75: "Strive and Strive", 76: "Trombones",
  77: "Sunset Strip", 78: "Heaven's Gate", 79: "One More Time", 80: "Gandhi's Breakfast",
  81: "Fat Lady with a Walking Stick", 82: "Straight On Through", 83: "Time for Tea",
  84: "Seven Dozen", 85: "Staying Alive", 86: "Between the Sticks", 87: "Torquay in Devon",
  88: "Two Fat Ladies", 89: "Nearly There", 90: "Top of the Shop"
};

export class AudioManager {
  private static instance: AudioManager;
  private settings: AudioSettings;
  private synthesizer: SpeechSynthesis;
  private audioContext: AudioContext | null = null;
  
  private constructor() {
    this.settings = {
      volume: 1.0,
      rate: 0.9,
      pitch: 1.0,
      language: 'en-US',
      useCustomAudio: true,
      enabled: true
    };
    this.synthesizer = window.speechSynthesis;
  }
  
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  public initialize(): Promise<void> {
    this.synthesizer.cancel();
    return Promise.resolve();
  }
  
  public async announceNumber(number: number): Promise<void> {
    if (!this.settings.enabled) return;
    
    let text = number.toString();
    if (this.settings.useCustomAudio && numberCalls[number]) {
      text = `${number}. ${numberCalls[number]}`;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.lang = this.settings.language;
    
    this.synthesizer.speak(utterance);
  }
  
  public async playEffect(effectName: string): Promise<void> {
    if (!this.settings.enabled) return;
    
    this.createAudioContext();
    if (!this.audioContext) return;
    
    let frequency = 440; // Default A4
    let duration = 0.2;
    
    // Different sounds for different effects
    if (effectName.includes('Win')) {
      frequency = 880; // Higher for wins
      duration = 0.3;
    } else if (effectName.includes('Error')) {
      frequency = 220; // Lower for errors
      duration = 0.3;
    }
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1 * this.settings.volume, this.audioContext.currentTime);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }
  
  public async playPrizeWinEffect(prizeType: keyof Game.Winners): Promise<void> {
    if (!this.settings.enabled) return;
    
    this.createAudioContext();
    if (!this.audioContext) return;
    
    // Different patterns for different prizes
    const patterns: Record<string, number[][]> = {
      quickFive: [[440, 0.1], [523, 0.1], [659, 0.3]],
      fullHouse: [[440, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [880, 0.3]],
      default: [[440, 0.1], [659, 0.1], [880, 0.3]]
    };
    
    const pattern = patterns[prizeType] || patterns.default;
    
    let startTime = this.audioContext.currentTime;
    pattern.forEach(([freq, dur]) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.frequency.value = freq;
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.2 * this.settings.volume, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + dur);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + dur);
      
      startTime += dur;
    });
  }
  
  private createAudioContext(): void {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('Could not create AudioContext:', error);
      }
    }
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
  
  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
  }
  
  public cancelSpeech(): void {
    this.synthesizer.cancel();
  }
  
  public getNumberCall(number: number): string | undefined {
    return numberCalls[number];
  }
}

export default AudioManager;
