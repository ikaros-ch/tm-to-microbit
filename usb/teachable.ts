/**
 * Receive Teachable Machine classes from the tm-to-microbit web app over USB.
 * The web app sends the class name and a newline whenever the detected class changes.
 */
//% color=#1a73e8 icon="" block="Teachable Machine"
namespace teachable {
    const EVENT_ID = 9051 // custom event source; event value = index of the label + 1
    // Created on first use: when the extension is opened as a project, MakeCode runs
    // the user's code before this file's top level.
    let labels: string[]
    let current = ""

    /**
     * Handle one received class name. Also used by the Bluetooth extension.
     */
    //% blockHidden=1
    export function receive(label: string) {
        current = label
        if (!labels) return
        const i = labels.indexOf(label)
        if (i >= 0) control.raiseEvent(EVENT_ID, i + 1)
    }

    /**
     * Runs when the web app detects this class.
     * @param label class name exactly as written in Teachable Machine, eg: "Class 1"
     */
    //% blockId=teachable_on_class block="on class $label detected"
    //% label.defl="Class 1"
    export function onClass(label: string, handler: () => void) {
        if (!labels) labels = []
        if (labels.indexOf(label) < 0) labels.push(label)
        control.onEvent(EVENT_ID, labels.indexOf(label) + 1, handler)
    }

    /**
     * The last class received from the web app ("" before the first one).
     */
    //% blockId=teachable_current_class block="detected class"
    export function currentClass(): string {
        return current
    }

    // The default 20-byte receive buffer would drop longer class names. The Bluetooth UART buffer is fixed at ~60 bytes.
    serial.setRxBufferSize(128)
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), () => receive(serial.readUntil(serial.delimiters(Delimiters.NewLine))))
}
