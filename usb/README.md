# Teachable Machine (USB)

Receive [Teachable Machine](https://teachablemachine.withgoogle.com/) classes from the web app https://ikaros-ch.github.io/tm-to-microbit/ over USB. Radio keeps working. For Bluetooth use `https://github.com/ikaros-ch/tm-to-microbit/bluetooth`.

```blocks
// Show a heart when the web app detects "Class 1"
teachable.onClass("Class 1", function () {
    basic.showIcon(IconNames.Heart)
})
// Button A scrolls the last class name
input.onButtonPressed(Button.A, function () {
    basic.showString(teachable.currentClass())
})
```

* `on class "…" detected` ([help](docs/on-class.md)): runs when the web app detects that class. The name must match Teachable Machine exactly.
* `on class ID … detected` ([help](docs/on-class-id.md)): the same, using the class ID. IDs are the numbers next to each class in the web app (1, 2, 3… by default, and you can change them).
* `detected class`, `class ID`, `confidence` ([help](docs/current-class.md)) (0–100): the last class received. The confidence keeps updating while the class is shown, also when it drops below the web app's slider.
* `detected class [name|ID] and confidence` ([help](docs/class-and-confidence.md)): text such as `Class 1 87%` (empty before the first class), handy with `show string`.
* `confidence of class ID (2)` / `confidence of class "Class 2"` ([help](docs/confidence-of-id.md)): how sure the model is about *that* class right now (0–100), whether or not it is the detected one.
* `on web button [1|2] [pressed|released]` and `web button [1|2] is pressed` ([help](docs/on-web-button.md)): the two big **Button 1 / Button 2** buttons in the web app, like the A and B buttons on the micro:bit (hold to keep pressed). They work as soon as the web app is connected.

Blocks are available in English and Greek; MakeCode uses the language chosen in its settings.

The web app sends `id,confidence,name` and a newline over the micro:bit's USB serial (115200 baud).

Nothing happens? Press button A: if it shows the class, the name in `on class` doesn't match Teachable Machine exactly. The micro:bit shows no sign when the web app connects over USB. Class names can be up to 50 bytes if you may switch to Bluetooth later (about 50 Latin or 25 Greek letters); over USB longer names arrive whole.

## Learn more

* [Teachable Machine](https://teachablemachine.withgoogle.com/) and its [FAQ](https://teachablemachine.withgoogle.com/faq)
* [micro:bit Machine Learning projects (CreateAI)](https://microbit.org/ai/)
* [Web app](https://ikaros-ch.github.io/tm-to-microbit/) and [starter MakeCode program](https://makecode.microbit.org/S94523-20313-05753-47144)
* [MakeCode serial reference](https://makecode.microbit.org/reference/serial)

## License

MIT

## Supported targets

* for PXT/microbit
