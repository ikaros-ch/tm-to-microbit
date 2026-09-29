/**
 * Receive Teachable Machine classes from the web app over Bluetooth or USB.
 * The web app sends the class name followed by a newline whenever the detected class changes.
 */
//% color=#1a73e8 icon="" block="Teachable Machine"
namespace teachable {
    const EVENT_ID = 9051 // custom event source; event value = index of the label + 1
    let labels: string[] = []
    let current = ""

    function received(label: string) {
        current = label
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

    const NL = serial.delimiters(Delimiters.NewLine)
    bluetooth.startUartService()
    bluetooth.onUartDataReceived(NL, () => received(bluetooth.uartReadUntil(NL)))
    serial.onDataReceived(NL, () => received(serial.readUntil(NL)))
}
