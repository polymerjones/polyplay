import AVFoundation
import Foundation
import Capacitor
import PhotosUI
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
public class MediaImportPlugin: CAPPlugin, UIDocumentPickerDelegate, PHPickerViewControllerDelegate {
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

    @objc func pickArtworkFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.activeCall != nil {
                call.reject("Picker already active.")
                return
            }

            var configuration = PHPickerConfiguration(photoLibrary: .shared())
            configuration.selectionLimit = 1
            configuration.filter = .any(of: [.images, .videos])
            configuration.preferredAssetRepresentationMode = .current

            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self

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

        importSelectedAudioFile(sourceURL) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let imported):
                    call.resolve([
                        "cancelled": false,
                        "path": imported.path,
                        "name": imported.name,
                        "mimeType": imported.mimeType
                    ])
                case .failure(let error):
                    call.reject("Failed to import selected file.", nil, error)
                }
            }
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard let call = activeCall else { return }
        activeCall = nil
        guard let result = results.first else {
            call.resolve(["cancelled": true])
            return
        }

        importSelectedArtworkFile(result) { imported in
            DispatchQueue.main.async {
                switch imported {
                case .success(let payload):
                    call.resolve([
                        "cancelled": false,
                        "path": payload.path,
                        "name": payload.name,
                        "mimeType": payload.mimeType
                    ])
                case .failure(let error):
                    call.reject("Failed to import selected artwork.", nil, error)
                }
            }
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

    private func copyImportedFileToTemp(
        _ sourceURL: URL,
        preferredName: String? = nil
    ) throws -> (path: String, name: String, mimeType: String) {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("polyplay-imports", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let resolvedName = (preferredName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? preferredName!
            : sourceURL.lastPathComponent)
        let resolvedExtension = URL(fileURLWithPath: resolvedName).pathExtension
        let ext = !resolvedExtension.isEmpty ? resolvedExtension : (sourceURL.pathExtension.isEmpty ? "bin" : sourceURL.pathExtension)
        let preferredBaseName = URL(fileURLWithPath: resolvedName).deletingPathExtension().lastPathComponent
        let sourceBaseName = sourceURL.deletingPathExtension().lastPathComponent
        let baseName = !preferredBaseName.isEmpty ? preferredBaseName : (sourceBaseName.isEmpty ? "import" : sourceBaseName)
        let fileName = "\(UUID().uuidString)-\(baseName).\(ext)"
        let destinationURL = tempDir.appendingPathComponent(fileName)

        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }

        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        let exportName = !resolvedName.isEmpty ? resolvedName : sourceURL.lastPathComponent
        return (path: destinationURL.path, name: exportName, mimeType: mimeTypeForExtension(ext.lowercased()))
    }

    private func importSelectedArtworkFile(
        _ result: PHPickerResult,
        completion: @escaping (Result<(path: String, name: String, mimeType: String), Error>) -> Void
    ) {
        let provider = result.itemProvider
        let preferredName = provider.suggestedName
        var candidateTypes: [UTType] = [
            .quickTimeMovie,
            .mpeg4Movie,
            .movie,
            .image,
            .png,
            .jpeg
        ]
        if let webpType = UTType(filenameExtension: "webp") {
            candidateTypes.append(webpType)
        }

        guard let chosenType = candidateTypes.first(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else {
            completion(.failure(NSError(
                domain: "MediaImportPlugin",
                code: 4,
                userInfo: [NSLocalizedDescriptionKey: "Unsupported artwork type."]
            )))
            return
        }

        provider.loadFileRepresentation(forTypeIdentifier: chosenType.identifier) { url, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let sourceURL = url else {
                completion(.failure(NSError(
                    domain: "MediaImportPlugin",
                    code: 5,
                    userInfo: [NSLocalizedDescriptionKey: "Picker returned no artwork file."]
                )))
                return
            }

            do {
                completion(.success(try self.copyImportedFileToTemp(sourceURL, preferredName: preferredName)))
            } catch {
                completion(.failure(error))
            }
        }
    }

    private func importSelectedAudioFile(
        _ sourceURL: URL,
        completion: @escaping (Result<(path: String, name: String, mimeType: String), Error>) -> Void
    ) {
        let ext = sourceURL.pathExtension.lowercased()
        guard ext == "mov" || ext == "mp4" else {
            do {
                completion(.success(try copyImportedFileToTemp(sourceURL)))
            } catch {
                completion(.failure(error))
            }
            return
        }

        extractAudioToTemp(sourceURL, completion: completion)
    }

    private func extractAudioToTemp(
        _ sourceURL: URL,
        completion: @escaping (Result<(path: String, name: String, mimeType: String), Error>) -> Void
    ) {
        let asset = AVURLAsset(url: sourceURL)
        let compatiblePresets = AVAssetExportSession.exportPresets(compatibleWith: asset)
        guard compatiblePresets.contains(AVAssetExportPresetAppleM4A) else {
            do {
                completion(.success(try copyImportedFileToTemp(sourceURL)))
            } catch {
                completion(.failure(error))
            }
            return
        }

        guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            do {
                completion(.success(try copyImportedFileToTemp(sourceURL)))
            } catch {
                completion(.failure(error))
            }
            return
        }

        do {
            let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("polyplay-imports", isDirectory: true)
            try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

            let baseName = sourceURL.deletingPathExtension().lastPathComponent.isEmpty
                ? "import"
                : sourceURL.deletingPathExtension().lastPathComponent
            let fileName = "\(UUID().uuidString)-\(baseName).m4a"
            let destinationURL = tempDir.appendingPathComponent(fileName)

            if FileManager.default.fileExists(atPath: destinationURL.path) {
                try FileManager.default.removeItem(at: destinationURL)
            }

            exporter.outputURL = destinationURL
            exporter.outputFileType = .m4a
            exporter.shouldOptimizeForNetworkUse = false
            exporter.exportAsynchronously {
                switch exporter.status {
                case .completed:
                    completion(.success((
                        path: destinationURL.path,
                        name: "\(baseName).m4a",
                        mimeType: "audio/mp4"
                    )))
                case .failed:
                    completion(.failure(exporter.error ?? NSError(
                        domain: "MediaImportPlugin",
                        code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Audio extraction failed."]
                    )))
                case .cancelled:
                    completion(.failure(NSError(
                        domain: "MediaImportPlugin",
                        code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Audio extraction cancelled."]
                    )))
                default:
                    completion(.failure(NSError(
                        domain: "MediaImportPlugin",
                        code: 3,
                        userInfo: [NSLocalizedDescriptionKey: "Audio extraction did not complete."]
                    )))
                }
            }
        } catch {
            completion(.failure(error))
        }
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
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "webp":
            return "image/webp"
        default:
            return "application/octet-stream"
        }
    }
}
