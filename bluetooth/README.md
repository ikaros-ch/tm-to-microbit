# Teachable Machine (Bluetooth)

Receive [Teachable Machine](https://teachablemachine.withgoogle.com/) classes from the web app https://ikaros-ch.github.io/tm-to-microbit/ over Bluetooth, or over USB.

The extension asks for **No Pairing Required**, but MakeCode's ⚙ → **Project Settings** may still show *JustWorks*: select **No Pairing Required** there yourself, then download. Adding this extension removes **radio** blocks, because MakeCode can't use Bluetooth and radio together. If you need radio, use `https://github.com/ikaros-ch/tm-to-microbit/usb` instead.

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
* `detected class`, `class ID`, `confidence` (0–100): the last class received. The confidence keeps updating while the class is shown, also when it drops below the web app's slider.
* `detected class [name|ID] and confidence`: text such as `Class 1 87%` (empty before the first class), handy with `show string`.

Blocks are available in English and Greek; MakeCode uses the language chosen in its settings.

**Important**
* ⚙ → **Project Settings**: select **No Pairing Required** (it isn't selected for you).
* Don't use **music** blocks with Bluetooth: the micro:bit can stop with **error 070**. Use the USB extension for music.
* Class names can be up to 50 bytes: about 50 Latin letters, or 25 Greek letters (Greek letters take 2 bytes each). Longer names don't fit the micro:bit's Bluetooth receive buffer; the web app warns about them. Over USB they arrive whole.
