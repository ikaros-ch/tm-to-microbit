/**
 * Receive Teachable Machine classes from the tm-to-microbit web app over USB.
 * The web app sends "id,confidence,name" and a newline when the class changes
 * and when its confidence changes by 5 or more.
 */
//% color=#1a73e8 icon="" block="Teachable Machine"
namespace teachable {
    const EVENT_ID = 9051 // custom event source; event value = index of the label + 1
    const ID_EVENT_ID = 9052 // custom event source; event value = class ID + 1
    // Created on first use: when the extension is opened as a project, MakeCode runs
    // the user's code before this file's top level.
    let labels: string[]
    let current = ""
    let currentId = -1
    let conf = 0

    export enum ClassInfo {
        //% block="name"
        Name,
        //% block="ID"
        Id
    }

    /**
     * Handle one received line "id,confidence,name" (or just "name"). Also used by the Bluetooth extension.
     */
    //% blockHidden=1
    export function receive(line: string) {
        let id = -1
        let name = line
        const a = line.indexOf(",")
        const b = a < 0 ? -1 : line.indexOf(",", a + 1)
        if (b > 0) {
            id = parseInt(line.substr(0, a))
            if (isNaN(id)) id = -1
            const c = parseInt(line.substr(a + 1, b - a - 1))
            if (!isNaN(c)) conf = c // a missing confidence keeps the previous one
            name = line.substr(b + 1)
        }
        // Raise only the event whose value changed (a new confidence alone raises none).
        const nameChanged = name != current
        const idChanged = id != currentId
        current = name
        currentId = id
        if (nameChanged && labels) {
            const i = labels.indexOf(name)
            if (i >= 0) control.raiseEvent(EVENT_ID, i + 1)
        }
        if (idChanged && id >= 0) control.raiseEvent(ID_EVENT_ID, id + 1)
    }

    /**
     * Runs when the web app detects this class.
     * @param label class name exactly as written in Teachable Machine, eg: "Class 1"
     */
    //% blockId=teachable_on_class block="on class $label detected" weight=100
    //% label.defl="Class 1"
    export function onClass(label: string, handler: () => void) {
        if (!labels) labels = []
        if (labels.indexOf(label) < 0) labels.push(label)
        control.onEvent(EVENT_ID, labels.indexOf(label) + 1, handler)
    }

    /**
     * Runs when the web app detects the class with this ID (set next to each class in the web app).
     * @param id class ID, eg: 1
     */
    //% blockId=teachable_on_class_id block="on class ID $id detected" weight=90
    //% id.min=0 id.max=9999
    export function onClassId(id: number, handler: () => void) {
        control.onEvent(ID_EVENT_ID, id + 1, handler)
    }

    /**
     * The name of the last class received ("" before the first one).
     */
    //% blockId=teachable_current_class block="detected class" weight=80
    export function currentClass(): string {
        return current
    }

    /**
     * The ID of the last class received (-1 before the first one).
     */
    //% blockId=teachable_class_id block="class ID" weight=70
    export function classId(): number {
        return currentId
    }

    /**
     * How sure the model is about the detected class, 0 to 100.
     */
    //% blockId=teachable_confidence block="confidence" weight=60
    export function confidence(): number {
        return conf
    }

    /**
     * The detected class (name or ID) and its confidence as text, eg "Class 1 87%" ("" before the first one).
     */
    //% blockId=teachable_class_and_confidence block="detected class $what and confidence" weight=50
    export function classAndConfidence(what: ClassInfo): string {
        if (current == "" && currentId < 0) return ""
        return (what == ClassInfo.Id ? "" + currentId : current) + " " + conf + "%"
    }

    // The default 20-byte receive buffer would drop longer lines. The Bluetooth UART buffer is fixed at ~60 bytes.
    serial.setRxBufferSize(128)
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), () => receive(serial.readUntil(serial.delimiters(Delimiters.NewLine))))
}
