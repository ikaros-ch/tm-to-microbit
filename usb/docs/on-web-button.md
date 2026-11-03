# On web button

Runs when a button in the web app is pressed or released, like the A and B buttons on the micro:bit.

```sig
teachable.onWebButton(teachable.WebButton.One, teachable.WebButtonEvent.Pressed, function () {
    basic.showIcon(IconNames.Heart)
})
```

## Parameters

* **button**: which web button
* **event**: pressed or released
* **handler**: 

## Example

```blocks
teachable.onWebButton(teachable.WebButton.One, teachable.WebButtonEvent.Pressed, function () {
    basic.showIcon(IconNames.Heart)
})
```

```package
teachable-machine-usb=github:ikaros-ch/tm-to-microbit/usb
```
