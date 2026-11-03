// Test suite for teachable-machine-bluetooth.
// How to test: flash this, open https://ikaros-ch.github.io/tm-to-microbit/ on Chrome (Android or desktop),
// load a model with "Class 1/2/3", press Bluetooth and pick the micro:bit. PASS = every EXPECT matches.
// In the simulator there is no Bluetooth: PASS = runs with no errors.
// Teachable Machine's default class names are "Class 1", "Class 2", ... – rename to match your model.
// Project Settings must be "No Pairing Required". Avoid music blocks with Bluetooth (error 070).
bluetooth.onBluetoothConnected(() => basic.showIcon(IconNames.Yes))
// EXPECT: tick when the web app connects over Bluetooth (press Bluetooth in the app)
bluetooth.onBluetoothDisconnected(() => basic.showIcon(IconNames.No))
// EXPECT: cross when it disconnects
// EXPECT: every block below behaves as in usb/test.ts, over Bluetooth and over USB
teachable.onClass("Class 1", () => basic.showIcon(IconNames.Heart))
teachable.onClass("Class 2", () => basic.showIcon(IconNames.Happy))
teachable.onClassId(3, () => basic.showIcon(IconNames.Sad))
input.onButtonPressed(Button.A, () => basic.showString(teachable.classAndConfidence(teachable.ClassInfo.Name)))
input.onButtonPressed(Button.B, () => basic.showNumber(teachable.confidence()))
input.onButtonPressed(Button.AB, () => basic.showNumber(teachable.confidenceOfId(2)))
teachable.onWebButton(teachable.WebButton.One, teachable.WebButtonEvent.Pressed, () => basic.showString("1"))
teachable.onWebButton(teachable.WebButton.Two, teachable.WebButtonEvent.Pressed, () => basic.showString("2"))
