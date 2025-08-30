# 间隔重复选择逻辑分析

## 问题现象
- 原始：`repeat: spaced every 24 hours`
- 点击第4个按钮后：`repeat: spaced every 120 hours`
- 调试显示：`repeatPeriod: 120` (应该是24)

## 代码流程分析

### 1. getSpacedRepeatChoices() 函数
```typescript
function getSpacedRepeatChoices(repetition, now, settings) {
  const { repeatPeriod, repeatPeriodUnit, repeatTimeOfDay } = repetition;
  // 原始值：repeatPeriod = 24, repeatPeriodUnit = 'HOUR'
  
  const multiplierChoices = [0.5, 1.0, 1.5, 2.0].map((multiplier) => {
    // 计算下次复习时间
    let nextRepeatDueAt = now.plus({
      [repeatPeriodUnit]: multiplier * repeatPeriod,
    });
    // 对于24小时 * 2.0 = 48小时后
    
    // 计算小时差
    let { hours } = nextRepeatDueAt.diff(now, 'hours').values || {};
    hours = Math.round(hours);
    // hours = 48 (对于2.0倍数)
    
    return {
      text: `${summarizeDueAt(nextRepeatDueAt, now, true)} (x${multiplier})`,
      nextRepetition: {
        ...repetition, // 这里应该保持原始值
        repeatDueAt: nextRepeatDueAt,
      }
    };
  });
}
```

### 2. 问题分析
从调试日志看，`repeatPeriod: 120` 说明原始数据已经被污染。

可能的原因：
1. 之前的代码修改了原始repetition对象
2. 文件中的数据本身就是错误的
3. 解析过程中出现问题

### 3. 需要检查的地方
1. parsers.ts - 解析frontmatter时是否修改了数据
2. 之前版本的choices.ts是否修改了原始对象
3. 数据库中是否存储了错误的数据

## 解决方案
需要确保：
1. 原始repetition对象不被修改
2. nextRepetition只更新repeatDueAt
3. 保持repeatPeriod和repeatPeriodUnit不变
