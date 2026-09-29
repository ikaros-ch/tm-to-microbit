// Adds the Bluetooth UART service to the Teachable Machine blocks (USB keeps working too).
namespace teachable {
    bluetooth.startUartService()
    bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), () => receive(bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))))
}
