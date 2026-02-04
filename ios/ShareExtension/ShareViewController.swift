import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private var didProcess = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isOpaque = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didProcess else { return }
        didProcess = true
        extractSharedURL { [weak self] url in
            self?.finishWithURL(url)
        }
    }

    // MARK: - Extract shared content

    private func extractSharedURL(completion: @escaping (URL?) -> Void) {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            completion(nil)
            return
        }

        for item in items {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                let urlTypes: [UTType] = [.url, .fileURL]
                for type in urlTypes {
                    if provider.hasItemConformingToTypeIdentifier(type.identifier) {
                        provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { data, _ in
                            DispatchQueue.main.async {
                                if let url = data as? URL {
                                    completion(url)
                                } else if let str = data as? String, let url = URL(string: str) {
                                    completion(url)
                                } else {
                                    completion(nil)
                                }
                            }
                        }
                        return
                    }
                }

                let textTypes: [UTType] = [.plainText, .text]
                for type in textTypes {
                    if provider.hasItemConformingToTypeIdentifier(type.identifier) {
                        provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { data, _ in
                            DispatchQueue.main.async {
                                if let text = data as? String {
                                    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
                                    let range = NSRange(text.startIndex..., in: text)
                                    completion(detector?.firstMatch(in: text, options: [], range: range)?.url)
                                } else {
                                    completion(nil)
                                }
                            }
                        }
                        return
                    }
                }
            }
        }

        completion(nil)
    }

    // MARK: - Open main app via deep link

    private func openMainApp(with sharedURL: URL) {
        var components = URLComponents()
        components.scheme = "recipeapp"
        components.host = "add-recipe"
        components.queryItems = [
            URLQueryItem(name: "url", value: sharedURL.absoluteString),
            URLQueryItem(name: "autoExtract", value: "1"),
        ]
        guard let deepLink = components.url else { return }

        // Primary: Apple's extension API (available iOS 8+).
        extensionContext?.open(deepLink, completionHandler: nil)

        // Fallback: ObjC runtime — UIApplication.shared.open(_:options:completionHandler:)
        // The modern method (iOS 10+) requires IMP casting because it has 3 params.
        if let appClass = NSClassFromString("UIApplication"),
           let shared = (appClass as AnyObject)
               .perform(NSSelectorFromString("sharedApplication"))?
               .takeUnretainedValue() {
            let selector = NSSelectorFromString("openURL:options:completionHandler:")
            if shared.responds(to: selector) {
                let imp = shared.method(for: selector)
                typealias OpenURL = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, Any?) -> Void
                let open = unsafeBitCast(imp, to: OpenURL.self)
                open(shared, selector, deepLink as NSURL, NSDictionary(), nil)
            }
        }
    }

    private func finishWithURL(_ sharedURL: URL?) {
        if let sharedURL = sharedURL {
            openMainApp(with: sharedURL)
        }
        // Delay teardown so the system has time to dispatch the URL open.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.done()
        }
    }

    private func done() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
