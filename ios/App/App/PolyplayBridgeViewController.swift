import Foundation
import Capacitor
import UniformTypeIdentifiers
import UIKit

class PolyplayBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NowPlayingPlugin())
        bridge?.registerPluginInstance(MediaImportPlugin())
    }
}

@objc(MediaImportPlugin)
public class MediaImportPlugin: CAPPlugin, UIDocumentPickerDelegate {
    private var activeCall: CAPPluginCall?

    @objc func pickAudioFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.activeCall != nil {
                call.reject("Picker already active.")
                return
            }

            let picker = UIDocumentPickerViewController(
                forOpeningContentTypes: self.supportedAudioImportTypes(),
                asCopy: true
            )
            picker.delegate = self
            picker.allowsMultipleSelection = false
            picker.modalPresentationStyle = .formSheet

            self.activeCall = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let call = activeCall else { return }
        activeCall = nil
        call.resolve(["cancelled": true])
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = activeCall else { return }
        activeCall = nil
        guard let sourceURL = urls.first else {
            call.resolve(["cancelled": true])
            return
        }

        let scoped = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if scoped {
                sourceURL.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let imported = try copyImportedFileToTemp(sourceURL)
            call.resolve([
                "cancelled": false,
                "path": imported.path,
                "name": imported.name,
                "mimeType": imported.mimeType
            ])
        } catch {
            call.reject("Failed to import selected file.", nil, error)
        }
    }

    private func supportedAudioImportTypes() -> [UTType] {
        var types: [UTType] = [.audio, .mpeg4Movie, .quickTimeMovie, .movie]
        ["wav", "mp3", "m4a", "aac", "mp4", "mov"].forEach { ext in
            if let type = UTType(filenameExtension: ext) {
                types.append(type)
            }
        }
        return types
    }

    private func copyImportedFileToTemp(_ sourceURL: URL) throws -> (path: String, name: String, mimeType: String) {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("polyplay-imports", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let ext = sourceURL.pathExtension.isEmpty ? "bin" : sourceURL.pathExtension
        let baseName = sourceURL.deletingPathExtension().lastPathComponent.isEmpty
            ? "import"
            : sourceURL.deletingPathExtension().lastPathComponent
        let fileName = "\(UUID().uuidString)-\(baseName).\(ext)"
        let destinationURL = tempDir.appendingPathComponent(fileName)

        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }

        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        return (path: destinationURL.path, name: sourceURL.lastPathComponent, mimeType: mimeTypeForExtension(ext.lowercased()))
    }

    private func mimeTypeForExtension(_ ext: String) -> String {
        switch ext {
        case "wav":
            return "audio/wav"
        case "mp3":
            return "audio/mpeg"
        case "m4a":
            return "audio/mp4"
        case "aac":
            return "audio/aac"
        case "mp4":
            return "video/mp4"
        case "mov":
            return "video/quicktime"
        default:
            return "application/octet-stream"
        }
    }
}
