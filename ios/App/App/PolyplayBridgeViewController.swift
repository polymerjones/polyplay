import Foundation
import Capacitor

class PolyplayBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NowPlayingPlugin())
        bridge?.registerPluginInstance(MediaImportPlugin())
    }
}
