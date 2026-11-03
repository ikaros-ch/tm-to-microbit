// Test suite for teachable-machine-usb.
// How to test: flash this, open https://ikaros-ch.github.io/tm-to-microbit/, load a model with
// classes "Class 1", "Class 2", "Class 3", press USB and pick the micro:bit. Show each class to the camera.
// PASS = every EXPECT matches. In the simulator nothing is received: PASS = runs with no errors.
// Teachable Machine's default class names are "Class 1", "Class 2", ... – rename to match your model.
teachable.onClass("Class 1", () => basic.showIcon(IconNames.Heart))
// EXPECT: heart when Class 1 is detected
teachable.onClass("Class 2", () => basic.showIcon(IconNames.Happy))
// EXPECT: happy face for Class 2
teachable.onClassId(3, () => basic.showIcon(IconNames.Sad))
// EXPECT: sad face for class ID 3
input.onButtonPressed(Button.A, () => basic.showString(teachable.classAndConfidence(teachable.ClassInfo.Name)))
// EXPECT: A scrolls e.g. "Class 1 87%"
input.onButtonPressed(Button.B, () => basic.showNumber(teachable.confidence()))
// EXPECT: B shows the detected class confidence 0-100
input.onButtonPressed(Button.AB, () => basic.showNumber(teachable.confidenceOfId(2)))
// EXPECT: A+B shows class ID 2 confidence (high only while Class 2 is shown)
teachable.onWebButton(teachable.WebButton.One, teachable.WebButtonEvent.Pressed, () => basic.showString("1"))
// EXPECT: pressing web Button 1 in the app shows "1"
teachable.onWebButton(teachable.WebButton.Two, teachable.WebButtonEvent.Pressed, () => basic.showString("2"))
// EXPECT: web Button 2 shows "2"
