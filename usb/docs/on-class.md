# On class

Runs when the web app detects this class.

```sig
teachable.onClass("Class 1", function () {
    basic.showIcon(IconNames.Heart)
})
```

## Parameters

* **label**: class name exactly as written in Teachable Machine
* **handler**: 

## Example

```blocks
teachable.onClass("Class 1", function () {
    basic.showIcon(IconNames.Heart)
})
```

```package
teachable-machine-usb=github:ikaros-ch/tm-to-microbit/usb
```
