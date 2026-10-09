import Foundation
import Combine

@MainActor
final class AppModel: ObservableObject {
    private let baseURL = (Bundle.main.object(forInfoDictionaryKey: "HESBAH_API_URL") as? String ?? "https://hesbah-server.tail957349.ts.net:8443").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    private let defaults = UserDefaults.standard

    @Published var token: String
    @Published var role: String
    @Published var displayName: String
    @Published var stores: [[String: Any]] = []
    @Published var products: [[String: Any]] = []
    @Published var orders: [[String: Any]] = []
    @Published var isBusy = false
    @Published var message = ""

    init() {
        token = defaults.string(forKey: "hesbah.ios.token") ?? ""
        role = defaults.string(forKey: "hesbah.ios.role") ?? ""
        displayName = defaults.string(forKey: "hesbah.ios.name") ?? ""
    }

    private func request(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let url = URL(string: baseURL + path) else { throw AppError(message: "عنوان السيرفر غير صحيح") }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppError(message: "استجابة غير صالحة من السيرفر") }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(http.statusCode) else {
            let errorText = json["message"] as? String ?? "حدث خطأ في الاتصال (\(http.statusCode))"
            if http.statusCode == 401 { logout() }
            throw AppError(message: errorText)
        }
        return json
    }

    func login(username: String, password: String) async {
        isBusy = true; message = ""
        defer { isBusy = false }
        do {
            let result = try await request("/api/auth/login", method: "POST", body: ["username": username, "password": password])
            guard let newToken = result["token"] as? String, let user = result["user"] as? [String: Any] else {
                throw AppError(message: "بيانات الدخول التي رجعت من السيرفر غير مكتملة")
            }
            token = newToken
            role = user["role"] as? String ?? "customer"
            displayName = user["name"] as? String ?? username
            defaults.set(token, forKey: "hesbah.ios.token")
            defaults.set(role, forKey: "hesbah.ios.role")
            defaults.set(displayName, forKey: "hesbah.ios.name")
            await refresh()
        } catch { message = error.localizedDescription }
    }

    func register(name: String, phone: String, email: String, username: String, password: String) async {
        isBusy = true; message = ""
        defer { isBusy = false }
        do {
            let result = try await request("/api/auth/register", method: "POST", body: [
                "name": name, "phone": phone, "email": email, "username": username, "password": password
            ])
            guard let newToken = result["token"] as? String, let user = result["user"] as? [String: Any] else {
                throw AppError(message: "تعذر إنشاء جلسة الحساب")
            }
            token = newToken
            role = user["role"] as? String ?? "customer"
            displayName = user["name"] as? String ?? name
            defaults.set(token, forKey: "hesbah.ios.token")
            defaults.set(role, forKey: "hesbah.ios.role")
            defaults.set(displayName, forKey: "hesbah.ios.name")
            await refresh()
        } catch { message = error.localizedDescription }
    }

    func logout() {
        token = ""; role = ""; displayName = ""
        stores = []; products = []; orders = []
        defaults.removeObject(forKey: "hesbah.ios.token")
        defaults.removeObject(forKey: "hesbah.ios.role")
        defaults.removeObject(forKey: "hesbah.ios.name")
    }

    func refresh() async {
        guard !token.isEmpty else { return }
        do {
            if role == "driver" {
                let result = try await request("/api/orders")
                orders = result["orders"] as? [[String: Any]] ?? []
            } else {
                async let market = request("/api/marketplace")
                async let orderList = request("/api/orders")
                let (marketResult, ordersResult) = try await (market, orderList)
                stores = marketResult["stores"] as? [[String: Any]] ?? []
                orders = ordersResult["orders"] as? [[String: Any]] ?? []
            }
            message = ""
        } catch { message = error.localizedDescription }
    }

    func loadProducts(storeId: String) async {
        do {
            let result = try await request("/api/stores/\(storeId)")
            products = result["products"] as? [[String: Any]] ?? []
            message = ""
        } catch { message = error.localizedDescription }
    }

    func createOrder(storeId: String, quantities: [String: Int], address: String) async {
        guard !address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            message = "اكتب عنوان التوصيل أولاً"; return
        }
        let items = quantities.filter { $0.value > 0 }.map { ["productId": $0.key, "qty": $0.value] as [String: Any] }
        guard !items.isEmpty else { message = "أضف منتجاً واحداً على الأقل للسلة"; return }
        isBusy = true; message = ""
        defer { isBusy = false }
        do {
            _ = try await request("/api/orders", method: "POST", body: [
                "storeId": storeId, "items": items, "address": address, "paymentMethod": "cash"
            ])
            products = []
            await refresh()
            message = "تم إرسال طلبك بنجاح"
        } catch { message = error.localizedDescription }
    }

    func updateOrder(_ order: [String: Any], status: String) async {
        guard let id = order["id"] as? String else { return }
        isBusy = true; message = ""
        defer { isBusy = false }
        do {
            _ = try await request("/api/orders/\(id)/status", method: "PATCH", body: ["status": status])
            await refresh()
            message = "تم تحديث حالة الطلب"
        } catch { message = error.localizedDescription }
    }

    func updateDriverAvailability(_ available: Bool) async {
        do {
            _ = try await request("/api/drivers/me/status", method: "PATCH", body: ["status": available ? "available" : "unavailable"])
            await refresh()
            message = available ? "أنت متاح لاستلام الطلبات" : "تم إيقاف التوفر"
        } catch { message = error.localizedDescription }
    }
}

struct AppError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}