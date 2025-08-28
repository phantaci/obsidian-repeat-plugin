import { Repeat } from "./repeat/repeatTypes";

export type CustomIntervalUnit = 's' | 'm' | 'h' | 'd';

export type ButtonColor = 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'cyan' | 'gray';

export interface CustomIntervalButton {
  amount: number;
  unit: CustomIntervalUnit;
  label: string;
  color: ButtonColor;
}

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  morningReviewTime: string;
  eveningReviewTime: string;
  defaultRepeat: Repeat;
  enqueueNonRepeatingNotes: boolean;
  useCustomIntervals: boolean;
  customIntervalButtons: CustomIntervalButton[];
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: '',
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  defaultRepeat: {
    repeatStrategy: 'SPACED',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
  },
  enqueueNonRepeatingNotes: false,
  useCustomIntervals: false,
  customIntervalButtons: [
    { amount: 10, unit: 's', label: '重来', color: 'red' },
    { amount: 10, unit: 'm', label: '简单', color: 'blue' },
    { amount: 1, unit: 'd', label: '良好', color: 'green' },
    { amount: 2, unit: 'd', label: '掌握', color: 'orange' },
  ],
};
