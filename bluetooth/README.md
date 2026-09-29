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
* `detected class`: the last class received.
