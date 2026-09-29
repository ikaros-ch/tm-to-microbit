# Teachable Machine → micro:bit

Run a [Teachable Machine](https://teachablemachine.withgoogle.com/) model (image, pose or audio) in the browser and send the detected class to a BBC micro:bit over **Web Bluetooth** or **WebUSB**. Works on Chrome for Android and desktop Chrome/Edge.

**Web app:** https://ikaros-ch.github.io/tm-to-microbit/

## MakeCode extensions

Add one of these inside a MakeCode project with **Extensions**, pasting the URL into the search box. Don't use *Import*, which opens the extension itself as a project.

> **Bluetooth:** in MakeCode open ⚙ → **Project Settings** and select **No Pairing Required** (the other options stop the phone from connecting). The extension asks for it, but MakeCode may still show *JustWorks*, so select it yourself.
> Don't use **music** blocks together with Bluetooth: the micro:bit can stop with **error 070**. If you need music, use the USB extension.

| Extension | URL | Radio |
|---|---|---|
| [Bluetooth](bluetooth/): no pairing (see above), also works over USB | `https://github.com/ikaros-ch/tm-to-microbit/bluetooth` | removed (MakeCode can't use both) |
| [USB](usb/) | `https://github.com/ikaros-ch/tm-to-microbit/usb` | kept |

Ready-made test programs: [microbit-test-bluetooth.hex](microbit-test-bluetooth.hex) and [microbit-test-usb.hex](microbit-test-usb.hex). They show heart / happy / sad icons for `Class 1/2/3`, and button A scrolls the last class.

## Use it

1. **micro:bit:** add an extension (above), build with the blocks below, and download.
2. **Teachable Machine:** *Export model → Upload (shareable link)*, copy the link.
3. **Web app:** paste the link, press **Load**, then **Bluetooth**, or plug in the micro:bit and press **USB**.

Tip: `…/tm-to-microbit/?model=<TM link>` pre-fills the model, which is handy for a QR code.

## Blocks

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

## Troubleshooting

* **Nothing happens on the micro:bit:** press button A (in the blocks above) to scroll the last class received. If it shows the class, the link works and the name in `on class "…" detected` doesn't match: it must be exactly the Teachable Machine class name, including capitals and spaces. If it shows nothing, check the web app's log and *Last sent*.
* **USB** shows no sign on the micro:bit when the web app connects; use button A as above. If connecting fails, close MakeCode and other tabs that use the micro:bit.
* Class names can be up to 50 bytes: about 50 Latin letters, or 25 Greek letters (Greek letters take 2 bytes each). Longer names don't fit the micro:bit's Bluetooth receive buffer; the web app warns about them. Over USB they arrive whole.
* Error **070** on the micro:bit with Bluetooth: remove the music blocks, or use the USB extension.
* Bluetooth connects, then fails: check ⚙ Project Settings → **No Pairing Required** and download again.
* Audio models also send their **Background Noise** class, so you can react to silence with `on class "Background Noise" detected`.
* A class is sent once it has stayed on top for 0.3 s (camera models) at or above the confidence slider. Raise the slider if the micro:bit switches too often.

## Classroom

* With **No Pairing Required**, anyone nearby can connect to any micro:bit that runs the Bluetooth extension, and a micro:bit takes one connection at a time.
* The chooser lists micro:bits as `BBC micro:bit [name]`, where the five-letter name is fixed per board. To find yours, add `basic.showString(control.deviceName())` on button B and note it before class.

## Protocol

`id,confidence,name` plus `\n` (for example `1,87,Class 1`). The name comes last so it may contain commas. The web app sends it when the top class changes and its confidence is at or above the slider value (default 80%), and again when the confidence moves by 5 or more (at most every 0.25 s). When no class reaches the slider, the last class sent stays and only its confidence keeps updating (same rule). The whole line must fit the micro:bit's 60-byte Bluetooth receive buffer, which leaves 50 bytes (UTF-8) for the name.

* Bluetooth: Nordic UART service `6e400001-b5a3-f393-e0a9-e50e24dcca9e`, written in 20-byte chunks.
* USB: DAPLink vendor commands `0x82` (set baud 115200) and `0x84` (UART write), the same ones MakeCode uses. Arrives on the micro:bit's `serial`.

## Android notes

* The web app is in English and Greek (ΕΛ button, top right; Greek phones get Greek automatically).

* The page must be served over `https://` (GitHub Pages is fine).
* Bluetooth: turn Bluetooth on. On Android 11 and older, Location must also be on for scanning.
* USB: use an OTG adapter or a USB-C to micro-USB cable. Chrome asks for permission to use the device.
* **Mirror** is on by default because Teachable Machine trains on a mirrored webcam. This matters for left/right poses.
* The screen stays awake while a model runs.

## Develop

`index.html` is the whole web app. Run `python -m http.server` and open `http://localhost:8000` (localhost counts as a secure context).
To build an extension, run `npx pxt target microbit && npx pxt install && npx pxt build` in `usb/` or `bluetooth/`. `bluetooth/` depends on `usb/` at a git tag, so bump both `version`s and the tag in `bluetooth/pxt.json` together when you release.
