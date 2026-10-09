import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.token.isEmpty {
                LoginView()
            } else if model.role == "driver" {
                DriverHomeView()
            } else if model.role == "customer" {
                CustomerHomeView()
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "person.crop.circle.badge.exclamationmark").font(.system(size: 44))
                    Text("هذا التطبيق مخصص للعملاء والمندوبين")
                    Button("تسجيل الخروج") { model.logout() }.buttonStyle(.borderedProminent)
                }.padding()
            }
        }
        .tint(Color(red: 1, green: 0.39, blue: 0.02))
    }
}

struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    @State private var isRegister = false
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16).fill(Color.orange).frame(width: 58, height: 58)
                            Image(systemName: "bag.fill").font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("HESBAH OFFER").font(.system(size: 25, weight: .black, design: .rounded))
                            Text("اطلبها. نجيبها.").foregroundStyle(.secondary)
                        }
                    }.padding(.top, 36)
                    Text(isRegister ? "إنشاء حساب جديد" : "أهلاً بك من جديد").font(.largeTitle.bold())
                    if isRegister {
                        TextField("الاسم بالكامل", text: $name).textContentType(.name)
                        TextField("رقم الهاتف", text: $phone).keyboardType(.phonePad)
                        TextField("البريد الإلكتروني", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    }
                    TextField("اسم المستخدم", text: $username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("كلمة المرور", text: $password).textContentType(isRegister ? .newPassword : .password)
                    if !model.message.isEmpty { Text(model.message).foregroundStyle(.red).font(.subheadline) }
                    Button {
                        Task {
                            if isRegister {
                                await model.register(name: name, phone: phone, email: email, username: username, password: password)
                            } else {
                                await model.login(username: username, password: password)
                            }
                        }
                    } label: {
                        HStack {
                            if model.isBusy { ProgressView().tint(.white) }
                            Text(isRegister ? "إنشاء الحساب" : "تسجيل الدخول").fontWeight(.bold)
                        }.frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent).disabled(model.isBusy)
                    Button(isRegister ? "عندي حساب بالفعل" : "إنشاء حساب عميل") { isRegister.toggle(); model.message = "" }
                        .frame(maxWidth: .infinity)
                    Spacer(minLength: 28)
                    Text("اتصل بالإنترنت لتسجيل الدخول واستخدام الطلبات.").font(.footnote).foregroundStyle(.secondary)
                }
                .textFieldStyle(.roundedBorder)
                .padding(22)
            }
            .background(Color(.systemGroupedBackground))
        }
    }
}

struct CustomerHomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedStore: [String: Any]?
    @State private var quantities: [String: Int] = [:]
    @State private var address = ""
    @State private var tab = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("أهلاً، \(model.displayName)").font(.headline)
                        Text("اطلب من متاجرك المفضلة").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("خروج") { model.logout() }.font(.subheadline)
                }.padding()
                if let store = selectedStore {
                    storeDetail(store)
                } else {
                    Picker("القسم", selection: $tab) {
                        Text("المتاجر").tag(0)
                        Text("طلباتي").tag(1)
                    }.pickerStyle(.segmented).padding(.horizontal)
                    if tab == 0 { storeList } else { orderList }
                }
                if !model.message.isEmpty {
                    Text(model.message).font(.footnote).foregroundStyle(model.message.contains("نجاح") ? .green : .red).padding(.horizontal)
                }
            }
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .task { await model.refresh() }
            .refreshable { await model.refresh() }
        }
    }

    private var storeList: some View {
        List {
            Section("المتاجر المتاحة") {
                ForEach(Array(model.stores.enumerated()), id: \.offset) { _, store in
                    Button {
                        selectedStore = store
                        quantities = [:]
                        Task { await model.loadProducts(storeId: store["id"] as? String ?? "") }
                    } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 13).fill(Color.orange.opacity(0.14)).frame(width: 56, height: 56)
                                Image(systemName: "storefront.fill").font(.title2).foregroundStyle(.orange)
                            }
                            VStack(alignment: .leading, spacing: 5) {
                                Text(store["name"] as? String ?? "متجر").font(.headline).foregroundStyle(.primary)
                                Text(store["category"] as? String ?? "عام").font(.caption).foregroundStyle(.secondary)
                                Text("⭐ \(String(describing: store["rating"] ?? "جديد"))  ·  توصيل \(money(store["deliveryFee"]))").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.left").foregroundStyle(.tertiary)
                        }.padding(.vertical, 5)
                    }.buttonStyle(.plain)
                }
            }
        }.listStyle(.insetGrouped)
    }

    private var orderList: some View {
        List {
            Section("طلباتي") {
                if model.orders.isEmpty { Text("لسه مفيش طلبات").foregroundStyle(.secondary) }
                ForEach(Array(model.orders.enumerated()), id: \.offset) { _, order in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack { Text("طلب #\(order["number"] as? String ?? "—")").font(.headline); Spacer(); Text(statusArabic(order["status"] as? String ?? "")).font(.caption.bold()).foregroundStyle(.orange) }
                        Text("الإجمالي: \(money(order["total"]))").font(.subheadline.bold())
                        Text(order["address"] as? String ?? "").font(.caption).foregroundStyle(.secondary)
                        if let id = order["id"] as? String, ["pending", "accepted"].contains(order["status"] as? String ?? "") {
                            Button("إلغاء الطلب") { Task { await model.updateOrder(order, status: "cancelled") } }.font(.caption)
                        }
                    }.padding(.vertical, 5)
                }
            }
        }.listStyle(.insetGrouped)
    }

    @ViewBuilder private func storeDetail(_ store: [String: Any]) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button { selectedStore = nil; model.products = []; quantities = [:] } label: {
                    Label("المتاجر", systemImage: "chevron.right")
                }
                Spacer()
                Text(store["name"] as? String ?? "المنتجات").font(.headline)
            }.padding()
            List {
                if model.products.isEmpty { Text("لا توجد منتجات متاحة أو جارٍ التحميل…").foregroundStyle(.secondary) }
                ForEach(Array(model.products.enumerated()), id: \.offset) { _, product in
                    let productId = product["id"] as? String ?? ""
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(product["name"] as? String ?? "منتج").font(.headline)
                            Text(product["description"] as? String ?? "").font(.caption).foregroundStyle(.secondary)
                            Text(money(product["price"])).font(.subheadline.bold()).foregroundStyle(.orange)
                        }
                        Spacer()
                        HStack(spacing: 12) {
                            Button { quantities[productId, default: 0] = max(0, quantities[productId, default: 0] - 1) } label: { Image(systemName: "minus.circle") }
                            Text("\(quantities[productId, default: 0])").monospacedDigit()
                            Button { quantities[productId, default: 0] += 1 } label: { Image(systemName: "plus.circle.fill") }.disabled((product["available"] as? Bool) == false || ((product["stock"] as? Int) == 0))
                        }.font(.title3)
                    }.padding(.vertical, 4)
                }
            }.listStyle(.plain)
            VStack(spacing: 10) {
                TextField("عنوان التوصيل بالتفصيل", text: $address, axis: .vertical).textFieldStyle(.roundedBorder)
                HStack {
                    Text("الدفع عند الاستلام").font(.subheadline)
                    Spacer()
                    Text("الإجمالي التقريبي: \(cartTotal)").font(.subheadline.bold())
                }
                Button {
                    Task {
                        await model.createOrder(storeId: store["id"] as? String ?? "", quantities: quantities, address: address)
                        if model.message.contains("بنجاح") {
                            selectedStore = nil; quantities = [:]; tab = 1
                        }
                    }
                } label: {
                    HStack { if model.isBusy { ProgressView().tint(.white) }; Text("تأكيد الطلب") }
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                }.buttonStyle(.borderedProminent).disabled(model.isBusy || quantities.values.reduce(0, +) == 0)
            }.padding().background(.background)
        }
    }

    private var cartTotal: String {
        let total = model.products.reduce(0.0) { partial, product in
            let id = product["id"] as? String ?? ""
            let price = (product["price"] as? NSNumber)?.doubleValue ?? 0
            return partial + price * Double(quantities[id, default: 0])
        }
        return String(format: "%.0f ج.م", total)
    }
}

struct DriverHomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("مندوب التوصيل").font(.headline)
                        Text(model.displayName).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("خروج") { model.logout() }
                }.padding()
                HStack(spacing: 12) {
                    Button("متاح لاستلام الطلبات") { Task { await model.updateDriverAvailability(true) } }.buttonStyle(.borderedProminent)
                    Button("إيقاف التوفر") { Task { await model.updateDriverAvailability(false) } }.buttonStyle(.bordered)
                }.padding(.horizontal).padding(.bottom, 8)
                if !model.message.isEmpty { Text(model.message).font(.footnote).foregroundStyle(.secondary).padding(.horizontal) }
                List {
                    Section("مهام التوصيل") {
                        if model.orders.isEmpty { Text("لا توجد طلبات مسندة إليك حالياً").foregroundStyle(.secondary) }
                        ForEach(Array(model.orders.enumerated()), id: \.offset) { _, order in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text("طلب #\(order["number"] as? String ?? "—")").font(.headline); Spacer(); Text(statusArabic(order["status"] as? String ?? "")).font(.caption.bold()).foregroundStyle(.orange) }
                                Text(order["address"] as? String ?? "").font(.subheadline)
                                Text("الإجمالي: \(money(order["total"]))").font(.caption).foregroundStyle(.secondary)
                                if let status = order["status"] as? String {
                                    if status == "driver_assigned" {
                                        actionButton("استلام الطلب", order: order, status: "picked_up")
                                    } else if status == "picked_up" {
                                        actionButton("بدء التوصيل", order: order, status: "out_for_delivery")
                                    } else if status == "out_for_delivery" {
                                        actionButton("تم التسليم", order: order, status: "delivered")
                                    }
                                }
                            }.padding(.vertical, 5)
                        }
                    }
                }.listStyle(.insetGrouped)
            }
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .task { await model.refresh() }
            .refreshable { await model.refresh() }
        }
    }

    private func actionButton(_ title: String, order: [String: Any], status: String) -> some View {
        Button(title) { Task { await model.updateOrder(order, status: status) } }
            .buttonStyle(.borderedProminent).disabled(model.isBusy)
    }
}

private func money(_ value: Any?) -> String {
    let amount = (value as? NSNumber)?.doubleValue ?? Double(value as? String ?? "") ?? 0
    return String(format: "%.0f ج.م", amount)
}

private func statusArabic(_ status: String) -> String {
    switch status {
    case "pending": return "جديد"
    case "accepted": return "تم القبول"
    case "preparing": return "قيد التجهيز"
    case "ready_for_pickup": return "جاهز للاستلام"
    case "driver_assigned": return "تم تعيين المندوب"
    case "picked_up": return "تم الاستلام"
    case "out_for_delivery": return "خارج للتوصيل"
    case "delivered": return "تم التسليم"
    case "cancelled": return "ملغي"
    default: return status
    }
}