import qrcode
from PIL import Image, ImageDraw, ImageFont
import uuid
import os

def register_student(name, class_name, phone):
    """
    Yangi o'quvchini ro'yxatga olish va QR-kod yaratish funksiyasi.
    """
    # 1. Unikal ID yaratish
    student_id = str(uuid.uuid4())[:8].upper()
    
    # 2. QR-kod yaratish
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(student_id)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    
    # 3. Rasmga matn qo'shish (Ism va Sinf)
    width, height = qr_img.size
    new_height = height + 100
    canvas = Image.new('RGB', (width, new_height), 'white')
    canvas.paste(qr_img, (0, 0))
    
    draw = ImageDraw.Draw(canvas)
    
    # Shrift yuklash (agar shrift bo'lmasa, default ishlatiladi)
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()
        
    # Matnni yozish
    draw.text((20, height + 10), f"Ism: {name}", fill="black", font=font)
    draw.text((20, height + 40), f"Sinf: {class_name}", fill="black", font=font)
    draw.text((20, height + 70), f"ID: {student_id}", fill="black", font=font)
    
    # 4. Saqlash
    file_path = f"qrcodes/QR_{student_id}.png"
    if not os.path.exists('qrcodes'):
        os.makedirs('qrcodes')
        
    canvas.save(file_path)
    
    print(f"O'quvchi {name} muvaffaqiyatli ro'yxatdan o'tdi.")
    print(f"QR-kod saqlandi: {file_path}")
    
    return {
        "id": student_id,
        "name": name,
        "class": class_name,
        "phone": phone,
        "qr_path": file_path
    }

# Ishlatib ko'rish:
if __name__ == "__main__":
    student_data = register_student("Alisher Navoiy", "9-A", "+998901234567")
    print(student_data)
