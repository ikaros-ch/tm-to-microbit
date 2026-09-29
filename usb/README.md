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
* `detected class`: the last class received.

The web app sends the class name and a newline over the micro:bit's USB serial (115200 baud).
