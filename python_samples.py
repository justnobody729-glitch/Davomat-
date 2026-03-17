import qrcode
import requests
from datetime import datetime

# 1. QR-kod yaratish funksiyasi
def generate_student_qr(student_id, filename="student_qr.png"):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(student_id)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filename)
    print(f"QR-kod saqlandi: {filename}")

# 2. Telegram Bot orqali xabar yuborish
def send_telegram_notification(chat_id, student_name, arrival_time):
    token = "YOUR_TELEGRAM_BOT_TOKEN"
    message = f"🔔 Bildirishnoma!\n\nFarzandingiz {student_name} soat {arrival_time}da maktabga keldi. ✅"
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("Xabar muvaffaqiyatli yuborildi.")
        else:
            print(f"Xatolik: {response.text}")
    except Exception as e:
        print(f"Server bilan bog'lanishda xatolik: {e}")

# 3. Skanerlash logikasi (Sodda ko'rinishda)
def process_scan(scanned_id, database):
    # Bu yerda bazadan o'quvchini qidirish logikasi bo'ladi
    student = database.get(scanned_id)
    if student:
        arrival_time = datetime.now().strftime("%H:%M:%S")
        print(f"{student['name']} keldi. Vaqt: {arrival_time}")
        
        # Ota-onaga xabar yuborish
        send_telegram_notification(student['parent_chat_id'], student['name'], arrival_time)
    else:
        print("O'quvchi topilmadi!")

# Namuna ishlatilishi:
if __name__ == "__main__":
    # generate_student_qr("ST-12345")
    # send_telegram_notification("123456789", "Ali Valiyev", "08:15")
    pass
