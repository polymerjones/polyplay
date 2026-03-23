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
    private let appTitle = "PolyPlay Audio"

    @objc func setNowPlayingItem(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
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

            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            call.resolve()
        }
    }

    @objc func updatePlaybackState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
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
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }
}
