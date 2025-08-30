import { DateTime } from 'luxon';
import { getRepeatChoices } from './choices';
import { Repetition } from './repeatTypes';
import { RepeatPluginSettings } from '../settings';

// Test case for repeat property modification issue
function testSpacedRepeatChoicesPreserveOriginalRepeat() {
  console.log('=== Testing Spaced Repeat Choices Preserve Original Repeat ===');
  
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

  // Test case: Original repeat is "spaced every 24 hours"
  const originalRepetition: Repetition = {
    repeatStrategy: 'SPACED',
    repeatPeriod: 24,
    repeatPeriodUnit: 'HOUR',
    repeatTimeOfDay: 'AM',
    repeatDueAt: DateTime.now().minus({ hours: 1 }), // Overdue by 1 hour
    hidden: true,
    virtual: false
  };

  console.log('Original repetition:', {
    repeatStrategy: originalRepetition.repeatStrategy,
    repeatPeriod: originalRepetition.repeatPeriod,
    repeatPeriodUnit: originalRepetition.repeatPeriodUnit
  });

  const choices = getRepeatChoices(originalRepetition, mockSettings);
  
  console.log(`Generated ${choices.length} choices:`);
  choices.forEach((choice, index) => {
    console.log(`Choice ${index + 1}: "${choice.text}"`);
    
    if (choice.nextRepetition !== 'DISMISS' && choice.nextRepetition !== 'NEVER') {
      const nextRep = choice.nextRepetition as Repetition;
      console.log(`  - repeatStrategy: ${nextRep.repeatStrategy}`);
      console.log(`  - repeatPeriod: ${nextRep.repeatPeriod}`);
      console.log(`  - repeatPeriodUnit: ${nextRep.repeatPeriodUnit}`);
      console.log(`  - repeatDueAt: ${nextRep.repeatDueAt?.toISO()}`);
      
      // Check if original repeat properties are preserved
      if (nextRep.repeatStrategy !== originalRepetition.repeatStrategy ||
          nextRep.repeatPeriod !== originalRepetition.repeatPeriod ||
          nextRep.repeatPeriodUnit !== originalRepetition.repeatPeriodUnit) {
        console.log(`  ❌ PROBLEM: Choice ${index + 1} modifies original repeat properties!`);
        console.log(`     Expected: strategy=${originalRepetition.repeatStrategy}, period=${originalRepetition.repeatPeriod}, unit=${originalRepetition.repeatPeriodUnit}`);
        console.log(`     Got: strategy=${nextRep.repeatStrategy}, period=${nextRep.repeatPeriod}, unit=${nextRep.repeatPeriodUnit}`);
      } else {
        console.log(`  ✅ Choice ${index + 1} preserves original repeat properties`);
      }
    }
    console.log('');
  });
}

// Run the test
testSpacedRepeatChoicesPreserveOriginalRepeat();
