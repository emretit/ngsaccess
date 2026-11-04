"""Rebuild B2 static targets only; the four W3 HTML files are immutable inputs."""
from pathlib import Path
from html import escape
import json, hashlib
ROOT=Path(__file__).resolve().parent
CSS=(ROOT/'_b.css').read_text()
ICONS={
'home':'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
'history':'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l4 2"/>',
'qr':'<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 15v3h-3v3h3M12 3v3M3 12h3M12 9v3h3M12 18v3"/>',
'scan':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M3 12h18"/>',
'people':'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3c0-6 14-6 14 0v3M17 4c4 0 4 6 0 6M19 14c3 1 3 4 3 7"/>',
'profile':'<circle cx="12" cy="7" r="3"/><path d="M4 21v-3c0-6 16-6 16 0v3Z"/>',
'chevron':'<path d="m9 5 7 7-7 7"/>',
'back':'<path d="m14 5-7 7 7 7"/>',
'close':'<path d="m6 6 12 12M18 6 6 18"/>',
'check':'<path d="m5 12 4 4L19 6"/>',
'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
'warning':'<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
'error':'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8m0-8-8 8"/>',
'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2M7 18h2"/>',
'door':'<path d="M4 21h16M7 21V3h10v18M13 12h1"/>',
'request':'<path d="M8 5H4v16h16V5h-4M8 3h8v4H8zM8 12h8M8 16h5"/>',
'refresh':'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
'eye':'<path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>',
'lock':'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
'search':'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
'filter':'<path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/>',
'entry':'<path d="M12 3v15m-5-5 5 5 5-5M5 21h14"/>',
'exit':'<path d="M12 18V3m-5 5 5-5 5 5M5 21h14"/>',
'copy':'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
'camera':'<path d="M3 7h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/>',
'flash':'<path d="m13 2-8 12h6l-1 8 9-13h-7Z"/>',
'flip':'<path d="M4 8h13l-3-3m6 11H7l3 3M4 8v8m16-8v8"/>',
'empty':'<path d="M3 13 7 4h10l4 9v8H3Z"/><path d="M3 13h5l2 4h4l2-4h5"/>',
'moon':'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
'language':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/>',
'help':'<circle cx="12" cy="12" r="9"/><path d="M9 8c0-4 7-4 6 1-.5 2-3 2-3 5m0 3h.01"/>',
'logout':'<path d="M9 3H3v18h6m5-15 6 6-6 6m-7-6h13"/>',
'plus':'<path d="M12 4v16M4 12h16"/>',
'down':'<path d="m5 9 7 7 7-7"/>',
'phone':'<path d="M6 3H3c-1 9 9 19 18 18v-3l-5-3-3 2c-3-1-5-3-6-6l2-3Z"/>',
'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
'bell':'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/>',
'shield':'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
}
ICONS['system']='<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>'
def ico(n,cls=''):
 return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICONS[n]}</svg>'
def btn(label,kind='secondary',icon=None,busy=False,disabled=False,cls=''):
 content=('<span class="spinner" aria-hidden="true"></span>' if busy else ico(icon) if icon else '')+escape(label)
 return f'<button class="{kind} {cls}{" busy" if busy else ""}" type="button" {"disabled" if disabled or busy else ""}>{content}</button>'
def iconbtn(n,label):return f'<button class="icon-btn" type="button" aria-label="{escape(label)}">{ico(n)}</button>'
def badge(text,tone='success'):
 return f'<span class="badge {tone}">{ico(dict(success="check",warning="clock",danger="error",info="info")[tone])}{escape(text)}</span>'
def indicator(canvas=False):return f'<div class="indicator{" canvas" if canvas else ""}" aria-hidden="true"></div>'
def status(brand=False):
 return f'<div class="status{" brand-status" if brand else ""}" aria-hidden="true"><span>13:20</span><span class="system-icons"><svg viewBox="0 0 24 24"><path stroke-width="3" d="M3 19v-3M8 19v-6M13 19V9M18 19V5"/></svg><svg viewBox="0 0 24 24"><path d="M3 8c5-5 13-5 18 0M6 12c3-3 9-3 12 0m-9 4c2-2 4-2 6 0"/><circle cx="12" cy="20" r=".5"/></svg><svg class="battery" viewBox="0 0 28 24"><rect x="2" y="6" width="21" height="12" rx="3"/><path d="M26 10v4"/><rect x="5" y="9" width="15" height="6" rx="1" fill="currentColor" stroke="none"/></svg></span></div>'
def nav(selected):
 labels=[('home','Ana Sayfa'),('history','Geçmiş'),('qr','QR'),('people','Ziyaretçi'),('profile','Profil')]
 return '<footer class="nav-footer"><nav class="bottom-nav" aria-label="Ana gezinme">'+''.join(f'<button class="nav-item" type="button"'+(' aria-current="page"' if k==selected else '')+f'><span class="nav-icon">{ico(k)}</span>{label}</button>' for k,label in labels)+'</nav>'+indicator()+'</footer>'
def header(title,sub=None,back=False):
 # Multiline form titles keep a separate 48px back row, short titles use compact form.
 if back and len(title)>22:
  return '<header class="page-header with-back"><div class="backline">'+iconbtn('back','Geri')+'</div><h1>'+escape(title)+'</h1></header>'
 if back:return '<header class="page-header compact-back">'+iconbtn('back','Geri')+'<h1>'+escape(title)+'</h1></header>'
 return '<header class="page-header"><h1>'+escape(title)+'</h1>'+('<p class="context">'+escape(sub)+'</p>' if sub else '')+'</header>'
def band(title,home=False):
 return '<header class="brand-band'+('' if home else ' login-band')+'"><div class="brandbar"><span class="brand">NGS Plus</span>'+('<span class="avatar" aria-label="Ayşe Yılmaz">AY</span>' if home else '')+'</div><h1>'+escape(title)+'</h1>'+('<p class="context">NGS Teknoloji — Merkez</p><p class="date">4 Kasım Çarşamba</p>' if home else '')+'</header>'
def notice(message,tone='info',title=None,action=None):
 return f'<div class="notice {tone}" role="status">{ico(dict(info="info",warning="warning",danger="error",success="check")[tone])}<div class="copy">'+('<strong>'+escape(title)+'</strong>' if title else '')+'<p>'+escape(message)+'</p>'+(btn(action,'text-btn') if action else '')+'</div></div>'
def empty(title,message,icon='empty',action=None):
 return '<div class="empty">'+ico(icon)+'<h2>'+escape(title)+'</h2><p>'+escape(message)+'</p>'+(btn(action) if action else '')+'</div>'
def field(label,value='',kind='text',error=None,helper=None,disabled=False,placeholder='',ident=None,focus=False):
 attrs=(' disabled' if disabled else '')+(' id="'+ident+'"' if ident else '')
 if kind in ['select','date','time']:
  icon=dict(select='down',date='calendar',time='clock')[kind]
  control=f'<button class="field-control" type="button" aria-label="{escape(label+", "+(value or placeholder))}"{attrs}><span class="value">{escape(value or placeholder)}</span>{ico(icon)}</button>'
 elif kind=='textarea':
  control=f'<textarea class="field-control" readonly aria-label="{escape(label)}"{attrs}>{escape(value)}</textarea>'
 elif kind=='password':
  control=f'<div class="input-wrap"><input class="field-control" aria-label="{escape(label)}" type="password" readonly value="{escape(value)}" placeholder="{escape(placeholder)}"{attrs}>{iconbtn("eye","Şifreyi göster")}</div>'
 else:
  control=f'<input class="field-control" aria-label="{escape(label)}" readonly value="{escape(value)}" placeholder="{escape(placeholder)}"{attrs}>'
 return '<div class="field'+(' invalid' if error else '')+(' focused' if focus else '')+'"><span class="field-label">'+escape(label)+'</span>'+control+('<p class="error-text">'+escape(error)+'</p>' if error else '')+('<p class="helper">'+escape(helper)+'</p>' if helper else '')+'</div>'
def checkrow(label,checked=False):
 return '<label class="checkrow"><input type="checkbox" aria-label="'+escape(label)+'"'+(' checked' if checked else '')+'><span class="box" aria-hidden="true">'+(ico('check') if checked else '')+'</span><span>'+escape(label)+'</span></label>'
def row(title,sub=None,icon=None,selected=False,disabled=False,trailing=None,chevron=True):
 return '<button class="list-row'+(' selected' if selected else '')+(' disabled-row' if disabled else '')+'" type="button"'+(' disabled' if disabled else '')+'>'+ (ico(icon) if icon else '')+'<span class="copy"><strong>'+escape(title)+'</strong>'+('<span class="sub">'+escape(sub)+'</span>' if sub else '')+'</span>'+(trailing if trailing else ico('chevron','chevron') if chevron else '')+'</button>'
def group(content):return '<div class="list-group">'+content+'</div>'
def segments(labels,selected=0):
 return '<div class="segments" role="tablist">'+''.join('<button class="segment" type="button" role="tab" aria-selected="'+str(i==selected).lower()+'">'+escape(t)+'</button>' for i,t in enumerate(labels))+'</div>'
def actionbar(label,keyboard=False,secondary=None):
 return '<footer class="form-footer'+(' keyboard-footer' if keyboard else '')+'">'+('<div class="stack gap12">'+btn(secondary)+btn(label,'primary')+'</div>' if secondary else btn(label,'primary'))+('' if keyboard else indicator())+'</footer>'
def skeleton(kind='list'):
 if kind=='attendance':return '<div aria-label="Veriler yükleniyor" role="status"><div class="between"><h2>Bugün</h2><span class="skeleton" style="width:80px;height:26px"></span></div><div class="metrics">'+''.join('<div class="stack gap12"><span class="skeleton full"></span><span class="skeleton big full"></span></div>' for _ in range(3))+'</div><div class="skeleton short mt24"></div></div>'
 return '<div role="status" aria-label="Yükleniyor">'+''.join('<div class="skeleton-row"><span class="skeleton-icon"></span><div class="grow stack gap8"><span class="skeleton full"></span><span class="skeleton short"></span></div></div>' for _ in range(3))+'</div>'
def metrics(items):
 return '<div class="metrics">'+''.join('<div class="metric"><p class="metric-label">'+escape(a)+'</p><p class="metric-value">'+escape(b)+'</p></div>' for a,b in items)+'</div>'
def wrap(body,active=None,foot=None,brand=False):
 return status(brand)+'<div class="screen">'+body+'</div>'+(nav(active) if active else foot if foot is not None else indicator(True))
def modal(background,title,body,actions='',sheet=False):
 inert='<div class="screen covered" inert aria-hidden="true">'+background+'</div>'
 if sheet:
  front='<section class="sheet" role="dialog" aria-modal="true" aria-label="'+escape(title)+'"><div class="handle" aria-hidden="true"></div><div class="sheet-head"><h1>'+escape(title)+'</h1>'+iconbtn('close','Kapat')+'</div><div class="sheet-body">'+body+'</div>'+(actions if actions else indicator())+'</section>'
 else:front='<section class="dialog" role="dialog" aria-modal="true" aria-label="'+escape(title)+'"><h1>'+escape(title)+'</h1><div class="dialog-body">'+body+'</div><div class="dialog-actions">'+actions+'</div></section>'
 return inert+'<div class="overlay'+('' if sheet else ' dialog-overlay')+'">'+front+'</div>'

def login(state):
 filled=state!='empty';busy=state=='loading'
 content='<main class="scroll"><div class="pad app-form stack gap16">'
 content+=field('E-posta','ayse.yilmaz@example.test' if filled else '',placeholder='E-posta adresiniz',disabled=busy)
 content+=field('Şifre','GuvenliSifre2026' if filled else '',kind='password',placeholder='Şifreniz',disabled=busy)
 content+=checkrow('E-postamı hatırla',filled)
 content+='<div style="margin-top:-8px;text-align:left">'+btn('Şifre yardımı','text-btn')+'</div>'
 if state=='error':content+=notice('Mobil erişiminiz kapatıldı. Kurum yöneticinize başvurun.','danger')
 content+=btn('Giriş yapılıyor' if busy else 'Giriş yap','primary',busy=busy)
 content+='</div></main>'
 return wrap(band('Giriş yap')+content,brand=True)
def startup(state):
 content='<main class="scroll pad">'
 if state=='loading':content+='<div class="empty" style="padding-top:126px"><span class="spinner large" aria-hidden="true"></span><h2 class="mt24">NGS Plus başlatılıyor</h2><p>Oturumunuz kontrol ediliyor</p></div>'
 else:content+='<div style="padding-top:56px" class="stack gap24">'+notice('Oturum doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.','danger','Başlatılamadı')+'<p class="muted">Sorun devam ederse kurumunuzun sistem yöneticisine başvurun.</p>'+btn('Yeniden dene','primary')+btn('Giriş ekranına dön')+'</div>'
 return wrap(band('Başlatılıyor')+content+'</main>',brand=True)
def password_help():
 body=header('Şifre yardımı',back=True)+'<main class="scroll pad stack gap24">'
 body+='<section><h2>Yöneticinizle iletişime geçin</h2><p class="muted mt12">Kurum yöneticinizden kayıtlı e-postanıza şifre kurulum bağlantısı göndermesini isteyin. Şifrenizi belirledikten sonra giriş yapın.</p></section>'
 body+='<div class="readonly-note">Merhaba, NGS Plus mobil şifremi oluşturmak veya yenilemek istiyorum. Çalışan kaydımdaki e-posta adresime yeni bir şifre kurulum bağlantısı gönderebilir misiniz?</div>'
 body+=btn('Talebi kopyala','primary','copy')+btn('Giriş ekranına dön')+'<p class="screen-note">Bu ekran e-posta göndermez veya şifrenizi değiştirmez.</p></main>'
 return wrap(body)
def home(state='filled'):
 if state=='loading':card=skeleton('attendance')
 elif state=='error':card='<div class="between"><h2>Bugün</h2>'+badge('Durum alınamadı','warning')+'</div><p class="muted mt16">Bugünkü durum alınamadı.</p>'+btn('Yeniden dene','text-btn','refresh')
 else:
  card='<div class="between"><h2>Bugün</h2>'+badge('Bugün kayıt yok','info')+'</div>' if state=='empty' else '<div class="between"><h2>Bugün</h2>'+badge('İçeride')+'</div>'
  card+=metrics([('İlk giriş','—' if state=='empty' else '08:52'),('Son çıkış','—' if state=='empty' else '12:31'),('Son giriş','—' if state=='empty' else '13:14')])
  card+='<p class="fresh">Son güncelleme 13:20</p>'
 body='<main class="scroll">'+band('Merhaba, Ayşe Yılmaz',True)+'<div class="overlap"><section class="surface attendance">'+card+'</section></div><div class="pad stack gap16">'
 body+=btn('QR kod tara','primary','scan')+group(row('Kapıyı aç','Ana Giriş','door'))
 body+=group(row('Taleplerim',None,'request',trailing='<span class="count">1 bekleyen</span>')+row('Ziyaretçi davet et',None,'people'))+'</div></main>'
 return wrap(body,'home',brand=True)
def qr(mode):
 body=header('QR')+segments(['QR Kodum','Tara'],0 if mode=='expired' else 1)+'<main class="scroll pad">'
 if mode=='scan':
  body+='<div class="camera-frame" role="img" aria-label="QR tarama çerçevesi"><div class="camera-scene"><div class="wall"></div><div class="reader"><div class="reader-display">'+ico('qr')+'</div><span class="led"></span></div></div><div class="reticle"><span></span><span></span><span></span><span></span></div></div><p class="mt24" style="text-align:center">QR kodu çerçeveye alın</p><div class="camera-controls">'+iconbtn('flip','Kamerayı değiştir')+iconbtn('flash','Flaş')+'</div>'
 elif mode=='permission':body+=empty('Kamera izni gerekiyor','QR taramak için kamera izni gerekiyor. Ayarlardan kamera erişimini açın.','camera')+btn('Ayarları aç','primary')
 else:body+='<div class="qr-name"><p>Ayşe Yılmaz</p><small>NGS Teknoloji — Merkez</small></div><div class="qr-expired mt24">'+ico('clock')+'<h2>Kodun süresi doldu</h2><p class="muted">Geçiş için yeni bir kod alın.</p></div><p class="muted small mt16" style="text-align:center">Kalan süre: 0 sn</p><div class="mt24">'+btn('Yenile','secondary','refresh')+'</div>'
 return wrap(body+'</main>','qr')
def device(state):
 body=header('Kapı seç',back=True)+'<main class="scroll pad stack gap24">'+field('Kapılarda ara',placeholder='Kapı adı veya konum')
 if state=='empty':body+=empty('Henüz erişiminiz olan kapı yok','Kapı erişimi için kurum yöneticinize başvurun.','door')
 else:
  body+=group(row('Ana Giriş','Merkez · Ana bina','door',selected=True,trailing='<span class="radio on" aria-hidden="true"></span>')+row('Otopark Turnike','Merkez · Otopark','door',trailing='<span class="radio" aria-hidden="true"></span>')+row('Personel Girişi','Merkez · Yan bina','door',trailing='<span class="radio" aria-hidden="true"></span>')+row('Depo Kapısı','Şu anda erişim saatleri dışında','door',disabled=True,chevron=False))
  body+=btn('Seçimi kaldır')
 return wrap(body+'</main>')
def door_recovery():
 content='<p><strong>Ana Giriş</strong></p><p class="muted small mt8">Bugün 13:19</p><div class="mt16">'+notice('Yeniden komut göndermeden durumu kontrol edin.','warning','Sonuç belirsiz')+'</div><div class="mt16">'+btn('Durumu kontrol et','secondary','refresh')+'</div><p class="small muted mt16">Tekrar denerseniz aynı istek ve aynı kapı kullanılır. Komut sonucu fiziksel geçişi doğrulamaz.</p>'
 return modal(home(), 'Kapı işlemini kontrol et',content,btn('Aynı isteği yeniden gönder','primary')+btn('Kapat'))
def records(rows):
 return group(''.join('<button type="button" class="record'+(' denied' if kind=='error' else '')+'"><time>'+time+'</time>'+ico(kind)+'<span class="copy"><strong>'+escape(title)+'</strong><small>'+escape(place)+'</small></span></button>' for time,title,place,kind in rows))
TODAY=[('13:14','Giriş','Otopark Turnike','entry'),('12:31','Çıkış','Otopark Turnike','exit'),('08:52','Giriş','Ana Giriş','entry')]
def history(state='records'):
 sel={'records':0,'empty':0,'calendar':1,'summary':2}[state]
 body=header('Geçmiş','NGS Teknoloji — Merkez')+segments(['Kayıtlar','Takvim','Özet'],sel)
 if state in ['records','empty']:
  body+='<div class="filter-line"><span>2–4 Kas · Tüm kapılar</span>'+btn('Filtrele','text-btn','filter')+'</div><main class="scroll pad">'
  if state=='empty':body+=empty('Bu filtrelerle eşleşen kayıt yok','Tarih veya kapı filtresini değiştirin.','history',action='Filtreleri temizle')
  else:body+='<h2 class="day-heading">Bugün</h2>'+records(TODAY)+'<h2 class="day-heading">Dün</h2>'+records([('18:07','Çıkış','Ana Giriş','exit'),('08:48','Giriş','Ana Giriş','entry'),('08:46','Erişim reddedildi','Depo Kapısı','error')])+'<h2 class="day-heading">2 Kas Pzt</h2>'+records([('17:56','Çıkış','Ana Giriş','exit'),('08:55','Giriş','Ana Giriş','entry')])
 elif state=='calendar':
  body+='<main class="scroll pad"><div class="calendar-head">'+iconbtn('back','Önceki ay')+'<h2>Kasım 2026</h2>'+iconbtn('chevron','Sonraki ay')+'</div><div class="weekdays">'+''.join('<span>'+d+'</span>' for d in ['Pt','Sa','Ça','Pe','Cu','Ct','Pa'])+'</div><div class="calendar-grid">'
  for i in range(42):
   day=i-5;cls='calendar-day';label=str(day)
   if day<1:label=str(26+i);cls+=' faded'
   elif day>30:label=str(day-30);cls+=' faded'
   if day==4:cls+=' today selected'
   if day in [2,3,4]:cls+=' has-event'
   body+='<button type="button" class="'+cls+'" aria-label="'+escape(label+(' Ekim' if day<1 else ' Aralık' if day>30 else ' Kasım'))+'">'+label+'</button>'
  body+='</div><p class="helper">Noktalı günlerde kayıt var.</p><h2 class="day-heading">4 Kas Çar · 3 kayıt</h2>'+records(TODAY)
 else:
  body+='<main class="scroll pad"><div class="segments" style="margin:0">'+''.join('<button class="segment" type="button" role="tab" aria-selected="'+str(i==0).lower()+'">'+x+'</button>' for i,x in enumerate(['Bu ay','Bu hafta']))+'</div><h2 class="section-label">Bu ayın özeti</h2>'+metrics([('Toplam giriş','4'),('Toplam çıkış','3'),('Kayıtlı gün','3')])+'<div class="mt24 flex small">'+ico('error')+'<span>Reddedilen <strong>1</strong></span><span class="muted">Belirsiz 0</span></div><h2 class="section-label">Kapılara göre kayıtlar</h2>'+group(row('Ana Giriş','5 kayıt','door',chevron=False)+row('Otopark Turnike','2 kayıt','door',chevron=False)+row('Depo Kapısı','1 reddedilen kayıt','door',chevron=False))+'<div class="mt16">'+btn('Kayıtlar hakkında','text-btn','info')+'</div>'
 return wrap(body+'</main>','history')
def history_filter():
 content='<div class="stack gap24">'+field('Tarih','4 Kas Çar',kind='date')+'<section><h2>Kapı</h2><p class="helper">Bu listedeki kayıtlarda yer alan kapılar gösterilir.</p><div class="mt16">'+field('Kapılarda ara',placeholder='Kapı adı')+'</div><div class="mt16">'+group(row('Tüm kapılar',selected=True,trailing='<span class="radio on"></span>')+row('Ana Giriş',trailing='<span class="radio"></span>')+row('Otopark Turnike',trailing='<span class="radio"></span>'))+'</div></section></div>'
 return modal(history(),'Filtrele',content,actionbar('Filtreleri uygula',secondary='Filtreleri temizle'),True)
def detailrows(items):return '<dl>'+''.join('<div class="detail-row"><dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd></div>' for k,v in items)+'</dl>'
def history_detail():
 body=badge('Giriş','success')+'<div class="mt16">'+detailrows([('Tarih','4 Kas Çar'),('Saat','13:14'),('Kapı','Otopark Turnike'),('Konum','Merkez'),('Erişim','İzin verildi')])+'</div><p class="small muted mt24">Geçiş kayıtları gösterilir. Resmi devam ve çalışma süresi sonuçları farklı olabilir.</p>'
 return modal(history(),'Kayıt ayrıntısı',body,sheet=True)
def requests(state='leave'):
 sel=1 if state=='correction' else 0
 body=header('Taleplerim',back=True)+segments(['İzin','Kayıt düzeltme'],sel)+'<main class="scroll pad"><div class="mb16">'+btn('Yeni talep','primary','plus')+'</div>'
 if state=='empty':body+=empty('Henüz talebiniz yok','İzin veya kayıt düzeltme için yeni bir talep oluşturun.','request')
 elif state=='leave':
  body+='<div class="stack gap16">'+requestcard('Yıllık izin','9–11 Kas','Bekliyor','warning','Aile ziyareti için yıllık izin talebi.',True)+requestcard('Mazeret izni','22 Eki','Onaylandı','success','Randevum nedeniyle yarım gün izin.',False)+'</div>'
 else:body+='<div class="stack gap16">'+requestcard('Giriş kaydı düzeltme','3 Kas Sal','Onaylandı','success','Giriş 08:48 · Kartımı okutmama rağmen giriş saatim görünmüyor.',False)+requestcard('Çıkış kaydı düzeltme','27 Eki Sal','Onaylandı','success','Çıkış 18:05 · Çıkış kaydımın düzeltilmesini istiyorum.',False)+'</div>'
 return wrap(body+'</main>')
def requestcard(title,date,state,tone,note,withdraw):
 return '<article class="request-card"><div class="between"><h2>'+escape(title)+'</h2>'+badge(state,tone)+'</div><p class="dates">'+escape(date)+'</p><p class="note">'+escape(note)+'</p>'+(btn('Talebi geri çek') if withdraw else '')+'</article>'
def leave_form(state):
 error=state=='error'
 body=header('İzin talebi',back=True)+'<main class="scroll pad app-form stack gap16">'+field('İzin türü','Yıllık izin',kind='select')+field('Tarih aralığı','9–11 Kas',kind='date',error='Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor' if error else None)+field('Not','Aile ziyareti için yıllık izin talebi.',kind='textarea',helper='İsteğe bağlı · En fazla 500 karakter')+'</main>'+actionbar('İzin talebi gönder')
 return wrap(body,foot='')
def correction_form():
 body=header('Kayıt düzeltme talebi',back=True)+'<main class="scroll pad app-form stack gap16">'+field('Tarih','3 Kas Sal',kind='date')+field('Tür','Giriş',kind='select')+field('Giriş','08:48',kind='time',helper='Saatler Türkiye saatine göre girilir.')+field('Gerekçe','Kartımı okutmama rağmen giriş saatim görünmüyor.',kind='textarea',helper='5–300 karakter')+'</main>'+actionbar('Düzeltme talebi gönder')
 return wrap(body,foot='')
def withdraw():
 content='<p><strong>Yıllık izin · 9–11 Kas</strong></p><p class="muted mt16">Bu talebi geri çekmek istiyor musunuz?</p>'
 return modal(requests(),'Talebi geri çek',content,btn('Talebi geri çek','secondary destructive')+btn('Vazgeç'))

def visitorrow(name,period,state,tone,presence):
 return '<button class="visitor-row" type="button"><span class="between"><h2>'+escape(name)+'</h2>'+ico('chevron','chevron')+'</span><p>'+escape(period)+'</p>'+badge(state,tone)+'<p>'+escape(presence)+'</p></button>'
def visitors(state='filled'):
 body=header('Ziyaretçiler')+'<main class="scroll pad"><div class="mb16">'+btn('Ziyaretçi davet et','primary','plus')+'</div>'
 if state=='filled':
  body+=metrics([('Toplam','6'),('Erişim aktif','2'),('Onay bekliyor','1')])+'<div class="mt24 stack gap16">'+field('Davetlerde ara',placeholder='Ad veya soyad')+field('Erişim durumu','Tüm erişim durumları',kind='select')+'</div><div class="list-group mt24">'+visitorrow('İpek Şahin','Bugün 14:00–16:00','Aktivasyon bekliyor','warning','Fiziksel konum bilinmiyor')+visitorrow('Mert Kaya','Bugün 09:00–17:00','Erişim aktif','success','Son kayda göre içeride')+'</div>'
 elif state=='empty':body+=empty('Henüz davet yok','Ziyaretçi davet et düğmesiyle yeni bir davet oluşturun.','people')
 else:body+='<div class="mt24">'+notice('Davetler alınamadı. Yeniden deneyin.','danger')+'</div><div class="mt16">'+btn('Yeniden dene','secondary','refresh')+'</div>'
 return wrap(body+'</main>','people')
def keyboard():
 return '<div class="keyboard" aria-hidden="true"><div class="suggestions"><span>Görüşme</span><span>görüşmesi</span><span>görüşmek</span></div>'+''.join('<div class="key-row">'+''.join('<span class="key">'+k+'</span>' for k in line)+'</div>' for line in [['q','w','e','r','t','y','u','ı','o','p'],['a','s','d','f','g','h','j','k','l'],['⇧','z','x','c','v','b','n','m','⌫']])+'<div class="key-row last"><span class="key utility">123</span><span class="key utility">◎</span><span class="key space">boşluk</span><span class="key utility">Bitti</span></div>'+indicator()+'</div>'
def visitorform(mode):
 iskeyboard=mode=='keyboard'
 body=header('Ziyaretçi davet et',back=True)+'<main class="scroll pad app-form"'+(' data-scroll-to="visit-notes"' if iskeyboard else '')+'><h2 class="section-label">Kişi bilgileri</h2><div class="stack gap16">'+field('Ad','İpek')+field('Soyad','Şahin')+field('Telefon','0532 123 45 67')+'</div><h2 class="section-label">Ziyaret bilgileri</h2><div class="stack gap16">'+field('Ziyaret amacı','Proje görüşmesi')+field('Notlar','Toplantı salonunda görüşme.',kind='textarea',helper='İsteğe bağlı',ident='visit-notes',focus=iskeyboard)+'<div class="field-grid">'+field('Başlangıç tarihi','4 Kas Çar',kind='date')+field('Saat','14:00',kind='time')+'</div><div class="field-grid">'+field('Bitiş tarihi','4 Kas Çar',kind='date')+field('Saat','16:00',kind='time')+'</div>'+btn('Proje ziyaretçi aydınlatma metni','text-btn','info')+checkrow('Güncel aydınlatma metnini inceledim.',True)+'<p class="helper">Davet kaydı oluşturulduktan sonra yetkili aktivasyonu gerekir.</p></div></main>'+actionbar('Daveti kaydet',iskeyboard)+(keyboard() if iskeyboard else '')
 return wrap(body,foot='')
def visitordetail():
 content=badge('Aktivasyon bekliyor','warning')+'<p class="small muted mt12">Fiziksel konum bilinmiyor</p><div class="mt16">'+detailrows([('Başlangıç','Bugün 14:00'),('Bitiş','Bugün 16:00'),('Telefon','0532 123 45 67'),('Amaç','Proje görüşmesi'),('Notlar','Toplantı salonunda görüşme.')])+'</div><h2 class="mt24">Cihaz durumu</h2><p class="small muted mt8">Cihaz güncellemesi bekliyor</p><div class="stack gap12 mt24">'+btn('Düzenle')+btn('Daveti iptal et','secondary destructive')+'</div>'
 return modal(visitors(),'İpek Şahin',content,sheet=True)
def visitorcancel():
 content='<p><strong>İpek Şahin</strong></p><p class="muted mt8">Bugün 14:00–16:00</p><p class="mt16">Bu davet iptal edilsin mi?</p>'
 return modal(visitors(),'Daveti iptal et',content,btn('Daveti iptal et','secondary destructive')+btn('Vazgeç'))
def profile():
 body=header('Profil')+'<main class="scroll pad"><div class="profile-identity"><span class="avatar">AY</span><div class="grow"><h2>Ayşe Yılmaz</h2><p>ayse.yilmaz@example.test</p><p>NGS Teknoloji — Merkez</p></div></div><h2 class="profile-group-label">Hesap</h2>'+group(row('Hesap bilgileri',None,'profile')+row('Şifreyi değiştir',None,'lock'))+'<h2 class="profile-group-label">Tercihler</h2>'+group(row('Tema','Sistem','moon')+row('Dil','Türkçe','language')+row('Hızlı erişim kapısı','Ana Giriş','door'))+'<h2 class="profile-group-label">Destek</h2>'+group(row('Bildirimler',None,'bell')+row('Yardım',None,'help')+row('Teknik destek raporu',None,'request')+row('Hakkında',None,'info')+row('Gizlilik bilgileri',None,'shield'))+'<div class="mt24">'+btn('Çıkış yap','secondary destructive','logout')+'</div><p class="version">Sürüm 1.0.4 (derleme 1)</p></main>'
 return wrap(body,'profile')
def theme_sheet():
 content=group(row('Sistem',None,'system',selected=True,trailing='<span class="radio on"></span>')+row('Açık',None,'sun',trailing='<span class="radio"></span>')+row('Koyu',None,'moon',trailing='<span class="radio"></span>'))+'<p class="helper mt16">Görünüm cihazınızın ayarını izler.</p>'
 return modal(profile(),'Tema',content,sheet=True)

VIEWS=[]
def add(group_name,name,label,body,dark=False,notes=''):
 VIEWS.append(dict(group=group_name,name=name+('-dark' if dark else ''),label=label,body=body,dark=dark,notes=notes))
for st,lab in [('loading','Yükleniyor'),('error','Başlatma hatası')]:add('Açılış','startup-'+st,lab,startup(st))
for dark in [False,True]:
 for st,lab in [('empty','Boş form'),('error','Erişim kapatıldı'),('loading','Giriş yapılıyor')]:add('Giriş','login-'+st,lab,login(st),dark)
add('Şifre yardımı','password-help','Yöneticiye talep',password_help())
for st,lab in [('loading','İlk yükleme'),('error','Durum alınamadı'),('empty','Bugün kayıt yok')]:add('Ana Sayfa','home-'+st,lab,home(st))
for st,lab in [('scan','Tara · kamera'),('permission','Tara · izin yok'),('expired','Kodun süresi doldu')]:add('QR','qr-'+st,lab,qr(st))
for st,lab in [('filled','Seçili kapı'),('empty','Kapı bulunmuyor')]:add('Kapı işlemleri','device-'+st,lab,device(st))
add('Kapı işlemleri','door-recovery','Belirsiz işlemi kurtar',door_recovery())
for st,lab in [('calendar','Takvim'),('summary','Özet'),('empty','Kayıt yok')]:add('Geçmiş','history-'+st,lab,history(st))
add('Geçmiş','history-filter','Filtre sheet',history_filter())
add('Geçmiş','history-detail','Kayıt ayrıntısı',history_detail())
for dark in [False,True]:
 for st,lab in [('leave','İzin talepleri'),('correction','Düzeltme talepleri'),('empty','Talep yok')]:add('Talepler','requests-'+st,lab,requests(st),dark)
 for st,lab in [('filled','İzin formu · dolu'),('error','İzin formu · alan hatası')]:add('Talep formları','leave-'+st,lab,leave_form(st),dark)
add('Talep formları','correction-filled','Düzeltme formu',correction_form())
add('Talep formları','request-withdraw','Geri çekme onayı',withdraw())
for dark in [False,True]:
 for st,lab in [('filled','Davet listesi'),('empty','Davet yok'),('error','Yükleme hatası')]:add('Ziyaretçiler','visitors-'+st,lab,visitors(st),dark)
 for st,lab in [('filled','Ziyaretçi formu · dolu'),('keyboard','Klavye ve sabit eylem')]:add('Ziyaretçi formu','visitor-form-'+st,lab,visitorform(st),dark,notes='Klavye görünümü Notlar alanına kaydırılmıştır.' if st=='keyboard' else 'Formun devamı dikey kaydırılır; kaydetme eylemi sabittir.')
add('Ziyaretçi ayrıntısı','visitor-detail','Ayrıntı sheet',visitordetail())
add('Ziyaretçi ayrıntısı','visitor-cancel','İptal onayı',visitorcancel())
for dark in [False,True]:
 add('Profil','profile-main','Profil',profile(),dark)
 add('Profil','profile-theme','Tema seçici',theme_sheet(),dark)

# Scroll only the illustrated form viewport; never scroll the whole phone or footer.
SCRIPT='''<script>document.querySelectorAll('[data-scroll-to]').forEach(container=>{const target=document.getElementById(container.dataset.scrollTo);if(target){container.scrollTop=target.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-30;}});</script>'''
for v in VIEWS:
 html='<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NGS Plus · B · '+escape(v['label'])+'</title><style>'+CSS+'</style></head><body'+(' class="dark"' if v['dark'] else '')+'><div class="phone">'+v['body']+'</div>'+SCRIPT+'</body></html>\n'
 (ROOT/(v['name']+'.html')).write_text(html)
metadata=[{k:v for k,v in x.items() if k!='body'} for x in VIEWS]
existing=['home','history','qr','home-dark']
manifest={'viewport':[390,844],'deviceScaleFactor':2,'newViews':metadata,'existingReferences':[{'name':n,'sha256':hashlib.sha256((ROOT/(n+'.html')).read_bytes()).hexdigest()} for n in existing]}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'{len(VIEWS)} new standalone screens generated; four W3 HTML files retained')
