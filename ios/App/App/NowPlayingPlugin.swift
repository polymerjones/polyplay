import Foundation
import UIKit
import MediaPlayer
import Capacitor

@objc(NowPlayingPlugin)
public class NowPlayingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NowPlayingPlugin"
    public let jsName = "NowPlaying"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNowPlayingItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updatePlaybackState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearNowPlaying", returnType: CAPPluginReturnPromise)
    ]

    private var cachedTitle: String?
    private var cachedSubtitle: String?
    private var cachedArtworkDataUrl: String?
    private var cachedArtworkUrl: String?
    private let appTitle = "PolyPlay Audio"
    private var remoteCommandsConfigured = false

    public override func load() {
        super.load()
        configureRemoteCommandsIfNeeded()
    }

    private func configureRemoteCommandsIfNeeded() {
        guard !remoteCommandsConfigured else { return }
        remoteCommandsConfigured = true

        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.skipBackwardCommand.isEnabled = false
        commandCenter.skipForwardCommand.isEnabled = false

        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "play"])
            return .success
        }
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "pause"])
            return .success
        }
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "togglePlayPause"])
            return .success
        }
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "previousTrack"])
            return .success
        }
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "nextTrack"])
            return .success
        }
    }

    @objc func setNowPlayingItem(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.configureRemoteCommandsIfNeeded()
            let title = (call.getString("title") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty else {
                call.reject("title is required")
                return
            }

            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPMediaItemPropertyTitle] = title
            info[MPMediaItemPropertyAlbumTitle] = self.appTitle
            self.cachedTitle = title

            let subtitle = (call.getString("subtitle") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if subtitle.isEmpty {
                self.cachedSubtitle = nil
                info.removeValue(forKey: MPMediaItemPropertyArtist)
            } else {
                self.cachedSubtitle = subtitle
                info[MPMediaItemPropertyArtist] = subtitle
            }

            let artworkDataUrl = (call.getString("artworkDataUrl") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let artworkUrl = (call.getString("artworkUrl") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            self.cachedArtworkDataUrl = artworkDataUrl.isEmpty ? nil : artworkDataUrl
            self.cachedArtworkUrl = artworkUrl.isEmpty ? nil : artworkUrl

            if let artwork = self.resolveArtwork() {
                info[MPMediaItemPropertyArtwork] = artwork
            } else {
                info.removeValue(forKey: MPMediaItemPropertyArtwork)
            }

            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            call.resolve()
        }
    }

    @objc func updatePlaybackState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.configureRemoteCommandsIfNeeded()
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            let elapsedTime = max(0, call.getDouble("elapsedTime") ?? 0)
            let duration = max(0, call.getDouble("duration") ?? 0)
            let isPlaying = call.getBool("isPlaying") ?? false

            if let title = self.cachedTitle {
                info[MPMediaItemPropertyTitle] = title
            }
            if let subtitle = self.cachedSubtitle {
                info[MPMediaItemPropertyArtist] = subtitle
            } else {
                info.removeValue(forKey: MPMediaItemPropertyArtist)
            }
            if let artwork = self.resolveArtwork() {
                info[MPMediaItemPropertyArtwork] = artwork
            } else {
                info.removeValue(forKey: MPMediaItemPropertyArtwork)
            }
            info[MPMediaItemPropertyAlbumTitle] = self.appTitle
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsedTime
            if duration > 0 {
                info[MPMediaItemPropertyPlaybackDuration] = duration
            } else {
                info.removeValue(forKey: MPMediaItemPropertyPlaybackDuration)
            }
            info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
            info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0

            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            call.resolve()
        }
    }

    @objc func clearNowPlaying(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.cachedTitle = nil
            self.cachedSubtitle = nil
            self.cachedArtworkDataUrl = nil
            self.cachedArtworkUrl = nil
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    private func resolveArtwork() -> MPMediaItemArtwork? {
        guard let image = resolveArtworkImage() else { return nil }
        let size = image.size.width > 0 && image.size.height > 0 ? image.size : CGSize(width: 512, height: 512)
        return MPMediaItemArtwork(boundsSize: size) { _ in image }
    }

    private func resolveArtworkImage() -> UIImage? {
        if let dataUrl = cachedArtworkDataUrl, let image = imageFromDataUrl(dataUrl) {
            return image
        }
        if let urlString = cachedArtworkUrl, let image = imageFromUrl(urlString) {
            return image
        }
        return nil
    }

    private func imageFromDataUrl(_ dataUrl: String) -> UIImage? {
        guard let commaIndex = dataUrl.firstIndex(of: ",") else { return nil }
        let base64Part = String(dataUrl[dataUrl.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: base64Part, options: [.ignoreUnknownCharacters]) else { return nil }
        return UIImage(data: data)
    }

    private func imageFromUrl(_ urlString: String) -> UIImage? {
        let baseUrl = bridge?.webView?.url
        guard let url = URL(string: urlString, relativeTo: baseUrl)?.absoluteURL else { return nil }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }
}
