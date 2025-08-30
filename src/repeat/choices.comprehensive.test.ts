jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { getRepeatChoices } from './choices';
import { Repetition } from './repeatTypes';
import { RepeatPluginSettings } from '../settings';
import { serializeRepetition } from './serializers';

// Comprehensive test for repeat property preservation
describe('Repeat Property Preservation Tests', () => {
  const mockSettings: RepeatPluginSettings = {
    showDueCountInStatusBar: true,
    showRibbonIcon: true,
    ignoreFolderPath: '',
    morningReviewTime: '09:00',
    eveningReviewTime: '21:00',
    defaultRepeat: {
      repeatStrategy: 'SPACED',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
    },
    useCustomIntervals: false,
    customIntervalButtons: [],
    enqueueNonRepeatingNotes: false,
    autoPlayAudio: false,
    decks: []
  };

  test('spaced every 24 hours should preserve original repeat properties', () => {
    const originalRepetition: Repetition = {
      repeatStrategy: 'SPACED',
      repeatPeriod: 24,
      repeatPeriodUnit: 'HOUR',
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.now().minus({ hours: 1 }), // Overdue
      hidden: true,
      virtual: false
    };

    console.log('=== Original Repetition ===');
    console.log('repeatStrategy:', originalRepetition.repeatStrategy);
    console.log('repeatPeriod:', originalRepetition.repeatPeriod);
    console.log('repeatPeriodUnit:', originalRepetition.repeatPeriodUnit);

    const choices = getRepeatChoices(originalRepetition, mockSettings);
    
    console.log(`\n=== Generated ${choices.length} choices ===`);
    
    choices.forEach((choice, index) => {
      console.log(`\nChoice ${index + 1}: "${choice.text}"`);
      
      if (choice.nextRepetition !== 'DISMISS' && choice.nextRepetition !== 'NEVER') {
        const nextRep = choice.nextRepetition as Repetition;
        console.log(`  repeatStrategy: ${nextRep.repeatStrategy}`);
        console.log(`  repeatPeriod: ${nextRep.repeatPeriod}`);
        console.log(`  repeatPeriodUnit: ${nextRep.repeatPeriodUnit}`);
        
        // Serialize to see what would be written to frontmatter
        const serialized = serializeRepetition(nextRep);
        console.log(`  serialized repeat: "${serialized.repeat}"`);
        
        // CRITICAL ASSERTIONS
        expect(nextRep.repeatStrategy).toBe(originalRepetition.repeatStrategy);
        expect(nextRep.repeatPeriod).toBe(originalRepetition.repeatPeriod);
        expect(nextRep.repeatPeriodUnit).toBe(originalRepetition.repeatPeriodUnit);
        
        // Check serialization preserves original
        expect(serialized.repeat).toBe('spaced every 24 hours');
      }
    });
  });

  test('spaced every 1 day should preserve original repeat properties', () => {
    const originalRepetition: Repetition = {
      repeatStrategy: 'SPACED',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.now().minus({ hours: 1 }),
      hidden: true,
      virtual: false
    };

    const choices = getRepeatChoices(originalRepetition, mockSettings);
    
    choices.forEach((choice, index) => {
      if (choice.nextRepetition !== 'DISMISS' && choice.nextRepetition !== 'NEVER') {
        const nextRep = choice.nextRepetition as Repetition;
        const serialized = serializeRepetition(nextRep);
        
        console.log(`Choice ${index + 1} serialized: "${serialized.repeat}"`);
        
        expect(nextRep.repeatStrategy).toBe(originalRepetition.repeatStrategy);
        expect(nextRep.repeatPeriod).toBe(originalRepetition.repeatPeriod);
        expect(nextRep.repeatPeriodUnit).toBe(originalRepetition.repeatPeriodUnit);
        expect(serialized.repeat).toBe('spaced every day');
      }
    });
  });

  test('multiplier choices should not change repeat pattern', () => {
    const originalRepetition: Repetition = {
      repeatStrategy: 'SPACED',
      repeatPeriod: 12,
      repeatPeriodUnit: 'HOUR',
      repeatTimeOfDay: 'PM',
      repeatDueAt: DateTime.now().minus({ minutes: 30 }),
      hidden: false,
      virtual: false
    };

    const choices = getRepeatChoices(originalRepetition, mockSettings);
    
    // Should have 5 choices: skip + 4 multipliers (0.5x, 1.0x, 1.5x, 2.0x)
    expect(choices).toHaveLength(5);
    
    // Check multiplier choices (skip the first skip button)
    const multiplierChoices = choices.slice(1);
    
    multiplierChoices.forEach((choice, index) => {
      expect(choice.text).toMatch(/\(x\d+(\.\d+)?\)$/);
      
      if (choice.nextRepetition !== 'DISMISS' && choice.nextRepetition !== 'NEVER') {
        const nextRep = choice.nextRepetition as Repetition;
        const serialized = serializeRepetition(nextRep);
        
        console.log(`Multiplier choice ${index + 1}: "${choice.text}"`);
        console.log(`  Original: spaced every ${originalRepetition.repeatPeriod} ${originalRepetition.repeatPeriodUnit.toLowerCase()}s`);
        console.log(`  Result: "${serialized.repeat}"`);
        
        // MUST preserve original repeat pattern
        expect(nextRep.repeatStrategy).toBe(originalRepetition.repeatStrategy);
        expect(nextRep.repeatPeriod).toBe(originalRepetition.repeatPeriod);
        expect(nextRep.repeatPeriodUnit).toBe(originalRepetition.repeatPeriodUnit);
        expect(serialized.repeat).toBe('spaced every 12 hours in the evening');
      }
    });
  });
});
