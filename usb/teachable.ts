/**
 * Receive Teachable Machine classes from the tm-to-microbit web app over USB.
 * The web app sends lines ending in a newline: "id,confidence,name" when the class (or its confidence)
 * changes, "@index,id,name" once per class, "#c0,c1,..." with the confidence of every class, and
 * "!button,state" (state 1 = pressed, 0 = released) for the web app's two buttons.
 */
//% color=#1a73e8 icon="" block="Teachable Machine"
namespace teachable {
    const EVENT_ID = 9051 // custom event source; event value = index of the label + 1
    const ID_EVENT_ID = 9052 // custom event source; event value = class ID + 1
    const WEB_BUTTON_EVENT_ID = 9053 // custom event source; event value = button * 10 + WebButtonEvent
    // Created on first use: when the extension is opened as a project, MakeCode runs
    // the user's code before this file's top level.
    let labels: string[]
    let current = ""
    let currentId = -1
    let conf = 0
    // Every class of the model, from "@index,id,name" lines, and their confidences from "#c0,c1,..." lines.
    let tableIds: number[]
    let tableNames: string[]
    let confs: number[]
    let webDown = [false, false, false] // index 1 and 2: web button held down

    export enum WebButton {
        //% block="1"
        One = 1,
        //% block="2"
        Two = 2
    }

    export enum WebButtonEvent {
        //% block="pressed"
        Pressed = 1,
        //% block="released"
        Released = 2
    }

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
        if (line.charAt(0) == "@") {
            receiveTableRow(line.substr(1))
            return
        }
        if (line.charAt(0) == "!") {
            receiveWebButton(line.substr(1))
            return
        }
        if (line.charAt(0) == "#") {
            confs = []
            for (const c of line.substr(1).split(",")) confs.push(parseInt(c) || 0)
            return
        }
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

    // "button,state": the web app's button 1 or 2 was pressed (1) or released (0).
    function receiveWebButton(row: string) {
        const a = row.indexOf(",")
        if (a < 0) return
        const button = parseInt(row.substr(0, a))
        if (button != 1 && button != 2) return
        const down = parseInt(row.substr(a + 1)) == 1
        if (down == webDown[button]) return
        webDown[button] = down
        control.raiseEvent(WEB_BUTTON_EVENT_ID, button * 10 + (down ? WebButtonEvent.Pressed : WebButtonEvent.Released))
    }

    /**
     * Runs when a button in the web app is pressed or released, like the A and B buttons on the micro:bit.
     * @param button which web button, eg: WebButton.One
     * @param event pressed or released
     */
    //% blockId=teachable_on_web_button block="on web button $button $event" weight=40
    export function onWebButton(button: WebButton, event: WebButtonEvent, handler: () => void) {
        control.onEvent(WEB_BUTTON_EVENT_ID, button * 10 + event, handler)
    }

    /**
     * True while the web app's button is held down.
     * @param button which web button, eg: WebButton.One
     */
    //% blockId=teachable_web_button_pressed block="web button $button is pressed" weight=39
    export function webButtonPressed(button: WebButton): boolean {
        return webDown[button]
    }

    // "index,id,name": one class of the model. Index 0 starts a new table.
    function receiveTableRow(row: string) {
        const a = row.indexOf(",")
        const b = a < 0 ? -1 : row.indexOf(",", a + 1)
        if (b < 0) return
        const i = parseInt(row.substr(0, a))
        if (isNaN(i) || i < 0) return
        if (i == 0 || !tableIds) { tableIds = []; tableNames = [] }
        while (tableIds.length <= i) { tableIds.push(-1); tableNames.push("") }
        tableIds[i] = parseInt(row.substr(a + 1, b - a - 1))
        tableNames[i] = row.substr(b + 1)
    }

    function confidenceAt(i: number): number {
        return i >= 0 && confs && i < confs.length ? confs[i] : 0
    }

    /**
     * How sure the model is about the class with this ID right now, 0 to 100 (0 if unknown).
     * @param id class ID, eg: 2
     */
    //% blockId=teachable_confidence_of_id block="confidence of class ID $id" weight=45
    //% id.min=0 id.max=9999 id.defl=2
    export function confidenceOfId(id: number): number {
        return tableIds ? confidenceAt(tableIds.indexOf(id)) : 0
    }

    /**
     * How sure the model is about this class right now, 0 to 100 (0 if unknown).
     * @param label class name exactly as written in Teachable Machine, eg: "Class 2"
     */
    //% blockId=teachable_confidence_of_class block="confidence of class $label" weight=44
    //% label.defl="Class 2"
    export function confidenceOfClass(label: string): number {
        return tableNames ? confidenceAt(tableNames.indexOf(label)) : 0
    }

    // The default 20-byte receive buffer would drop longer lines. The Bluetooth UART buffer is fixed at ~60 bytes.
    serial.setRxBufferSize(128)
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), () => receive(serial.readUntil(serial.delimiters(Delimiters.NewLine))))
}
