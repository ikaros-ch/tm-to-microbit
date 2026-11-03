# On class id

Runs when the web app detects the class with this ID (set next to each class in the web app).

```sig
teachable.onClassId(1, function () {
    basic.showIcon(IconNames.Heart)
})
```

## Parameters

* **id**: class ID
* **handler**: 

## Example

```blocks
teachable.onClassId(1, function () {
    basic.showIcon(IconNames.Heart)
})
```

```package
teachable-machine-usb=github:ikaros-ch/tm-to-microbit/usb
```
