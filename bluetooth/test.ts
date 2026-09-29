// Teachable Machine's default class names are "Class 1", "Class 2", ... – rename to match your model.
// Project Settings must be "No Pairing Required". Avoid music blocks with Bluetooth (error 070).
bluetooth.onBluetoothConnected(() => basic.showIcon(IconNames.Yes))
bluetooth.onBluetoothDisconnected(() => basic.showIcon(IconNames.No))
teachable.onClass("Class 1", () => basic.showIcon(IconNames.Heart))
teachable.onClass("Class 2", () => basic.showIcon(IconNames.Happy))
teachable.onClassId(3, () => basic.showIcon(IconNames.Sad))
input.onButtonPressed(Button.A, () => basic.showString(teachable.classAndConfidence(teachable.ClassInfo.Name)))
input.onButtonPressed(Button.B, () => basic.showNumber(teachable.confidence()))
input.onButtonPressed(Button.AB, () => basic.showNumber(teachable.confidenceOfId(2)))
