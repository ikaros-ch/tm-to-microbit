# Teachable Machine (Bluetooth)

Receive [Teachable Machine](https://teachablemachine.withgoogle.com/) classes from the web app https://ikaros-ch.github.io/tm-to-microbit/ over Bluetooth, or over USB.

Bluetooth is set to **No Pairing Required**, so phones connect without pairing. Adding this extension removes **radio** blocks, because MakeCode can't use Bluetooth and radio together. If you need radio, use `https://github.com/ikaros-ch/tm-to-microbit/usb` instead.

```blocks
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
teachable.onClass("Class 1", function () {
    basic.showIcon(IconNames.Heart)
})
```

* `on class "…" detected`: runs when the web app detects that class. The name must match Teachable Machine exactly.
* `on class ID … detected`: the same, using the class ID. IDs are the numbers next to each class in the web app (1, 2, 3… by default, and you can change them).
* `detected class`, `class ID`, `confidence` (0–100): the last class received.
* `detected class [name|ID] and confidence`: text such as `Class 1 87%`, handy with `show string`.

Blocks are available in English and Greek; MakeCode uses the language chosen in its settings.

**Important**
* ⚙ → **Project Settings** must be **No Pairing Required**.
* Don't use **music** blocks with Bluetooth: the micro:bit can stop with **error 070**. Use the USB extension for music.
* Keep class names under 50 characters.
