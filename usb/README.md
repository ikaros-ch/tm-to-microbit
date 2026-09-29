# Teachable Machine (USB)

Receive [Teachable Machine](https://teachablemachine.withgoogle.com/) classes from the web app https://ikaros-ch.github.io/tm-to-microbit/ over USB. Radio keeps working. For Bluetooth use `https://github.com/ikaros-ch/tm-to-microbit/bluetooth`.

```blocks
teachable.onClass("Class 1", function () {
    basic.showIcon(IconNames.Heart)
})
input.onButtonPressed(Button.A, function () {
    basic.showString(teachable.currentClass())
})
```

* `on class "…" detected`: runs when the web app detects that class. The name must match Teachable Machine exactly.
* `on class ID … detected`: the same, using the class ID. IDs are the numbers next to each class in the web app (1, 2, 3… by default, and you can change them).
* `detected class`, `class ID`, `confidence` (0–100): the last class received. The confidence keeps updating while the class is shown, also when it drops below the web app's slider.
* `detected class [name|ID] and confidence`: text such as `Class 1 87%` (empty before the first class), handy with `show string`.

Blocks are available in English and Greek; MakeCode uses the language chosen in its settings.

The web app sends `id,confidence,name` and a newline over the micro:bit's USB serial (115200 baud).

Nothing happens? Press button A: if it shows the class, the name in `on class` doesn't match Teachable Machine exactly. The micro:bit shows no sign when the web app connects over USB. Class names can be up to 50 bytes if you may switch to Bluetooth later (about 50 Latin or 25 Greek letters); over USB longer names arrive whole.
