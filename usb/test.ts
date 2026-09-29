// Teachable Machine's default class names are "Class 1", "Class 2", ... – rename to match your model.
teachable.onClass("Class 1", () => basic.showIcon(IconNames.Heart))
teachable.onClass("Class 2", () => basic.showIcon(IconNames.Happy))
teachable.onClass("Class 3", () => basic.showIcon(IconNames.Sad))
input.onButtonPressed(Button.A, () => basic.showString(teachable.currentClass()))
