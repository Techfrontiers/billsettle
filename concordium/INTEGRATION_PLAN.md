# แผนผสาน BillSettle + Concordium — Trusted Agents Hackathon

> เขียน 15 พ.ย. 2026 · โปรเจกต์ "BillSettle" บน Encode Club (sydear เป็น Leader, ทีมคนเดียว)
> ส่งงานสุดท้าย: **10 ธ.ค. 2026 06:59 น. (เวลาไทย)** · สร้างของบน **testnet เท่านั้น**
> **ตัดสินใจ 15 พ.ย. 19:07 (sydear): ไม่ใช้ NEAR ในการลงทะเบียน — ลงทะเบียน BillSettle แบบ native บน Concordium ผ่านเว็บแอปตรงๆ (โมเดล A) ไม่ผ่าน MCP และไม่ผูกกุญแจ NEAR ด้วย CIS-8** NEAR ยังเป็นรางจ่ายบิลเหมือนเดิม (ไม่แตะสัญญา) แต่ตัวตนที่ลงทะเบียนคือบัญชี Concordium ของ sydear เอง

## 1. สรุปสั้นๆ — จะทำอะไร

BillSettle วันนี้คือ "ตัวแทนจ่ายบิลของร้านเล็กๆ" บน NEAR testnet: ร้านออกบิล → ลูกค้าจ่ายด้วย stablecoin (BSDD) → ระบบยืนยันบนเชนแล้วพลิกบิลเป็น **จ่ายแล้ว** + ออกใบเสร็จพร้อมเลขธุรกรรม

งาน Concordium คือเติม **"หลักฐานว่ามีคนจริงรับผิดชอบอยู่ข้างหลัง"** เข้าไป 3 ชิ้น โดย **ไม่รื้อของเดิมบน NEAR**:

1. **ป้าย Verified by Concordium** — เจ้าของร้าน (sydear) ยืนยันตัวตนครั้งเดียว ตัวแทนก็ได้ป้ายว่า "มีคนจริงรับผิดชอบ"
2. **Agent Registry + Agent Card (ERC-8004/CIS-8004)** — ลงทะเบียนตัวแทน BillSettle บนเชน Concordium ได้บัตรประจำตัว (Agent Card) ที่ใครก็ตรวจสอบได้
3. **x402** — ให้ตัวแทนอื่นจ่ายเงินเรียกใช้บริการของ BillSettle ได้ โดยทุกการจ่ายผูกกับตัวตนที่ยืนยันแล้ว

**หลักการสำคัญ:** NEAR ยังคงเป็นรางจ่ายเงินของบิลเหมือนเดิม (ไม่แตะสัญญา NEAR ที่ deploy แล้ว) ส่วน Concordium เป็น **ชั้นตัวตนและความรับผิดชอบ** ที่ครอบอยู่ข้างบน ไม่ใช่มาแทนที่ ลงทะเบียนแบบ **native (โมเดล A)** — ตัวตนที่ลงทะเบียนคือบัญชี Concordium ของ sydear ไม่ใช่บัญชี NEAR

---

## 2. ของที่มีอยู่แล้ว

### BillSettle วันนี้ (NEAR testnet — ห้ามแก้สัญญาที่ deploy แล้ว)

| ชิ้นส่วน | อยู่ที่ไหน | ทำอะไร |
|---|---|---|
| สัญญาบิล | `billsettle-bills.testnet` | เก็บรายการบิล, `create_bill` (ร้านเท่านั้น), `get_bill`, `list_bills`, รับเงินแล้วพลิกบิลเป็น Paid |
| สัญญาเหรียญ | `billsettle-token.testnet` | BSDD (mock NEP-141, 6 ทศนิยม) ใช้จ่ายบิล |
| หน้าเว็บ | `docs/index.html` + `docs/app.js` (GitHub Pages) | แดชบอร์ดตามสถานะ, หน้าบิล + QR, ใบเสร็จพร้อมลิงก์ Explorer |
| กระเป๋าเงิน | Meteor Wallet ผ่าน @near-wallet-selector | ลูกค้าเชื่อมกระเป๋าแล้วกด Pay (จ่ายด้วย `ft_transfer_call`, msg = รหัสบิล) |
| วิธีจ่าย | `ft_transfer_call` → `ft_on_transfer` | จ่ายตรงยอดพอดี บิลถึงพลิกเป็น Paid, บันทึกผู้จ่าย + เวลาจ่าย; เลขธุรกรรมเก็บใน localStorage ของเบราว์เซอร์ |

- โค้ด: https://github.com/Techfrontiers/billsettle (public)
- เดโมสด: https://techfrontiers.github.io/billsettle/
- บิลตัวอย่าง: B1 จ่ายแล้ว 620 BSDD, B2 จ่ายแล้ว 430 BSDD (sydear.testnet จ่าย 13 พ.ย. ยืนยันบนเชนแล้ว), B3 ยังไม่จ่าย 250 BSDD (ให้กรรมการลองจ่าย)

### ชิ้นส่วน Concordium (ที่งานนี้ให้ใช้)

| ชิ้นส่วน | คืออะไร (ภาษาบ้านๆ) | ลิงก์ |
|---|---|---|
| Agent Registry (CIS-8004) | ทะเบียนตัวแทนบนเชน — ลงทะเบียนแล้วได้ NFT เป็นบัตรประจำตัว | https://agent-registry.concordium.com/ |
| CIS-8 | ทะเบียนผูกกุญแจข้ามเชน — **ไม่ใช้ในงานนี้แล้ว** (ตัดสินใจ 15 พ.ย. 19:07: ไม่ผูกกุญแจ NEAR) | https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/index.html |
| ป้าย Verified by Concordium | ตัวป้าย = เลขที่อยู่ (token address) ของ NFT CIS-8004 นั่นเอง ใครก็เอาไปตรวจสอบบนเชนได้ | https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/concordium-badge.html |
| Agent Card | ไฟล์ JSON ที่บอกว่าตัวแทนคือใคร ทำอะไรได้ อยู่ที่ไหน — เก็บ hash ไว้บนเชน กันปลอม | ดูข้อ 4 ขั้นที่ 3 |
| x402 | วิธีจ่ายเงินผ่าน HTTP: เซิร์ฟเวอร์ตอบ 402 พร้อมราคา → ลูกค้าจ่าย stablecoin แล้วได้ของ | https://www.concordium.com/article/x402-explained-agentic-payments-identity |
| MCP server | เซิร์ฟเวอร์ที่ให้ AI/โปรแกรมเรียกใช้ทะเบียนได้ (เช็คป้าย, ตรวจสอบการ์ด) | https://agent-registry-mcp.concordium.com/mcp |
| กระเป๋า Concordium | Browser Wallet (Chrome) / Mobile Wallet — ใช้สร้างบัญชี testnet + ยืนยันตัวตน | https://docs.concordium.com/en/mainnet/technical-reference/wallets/guides/setup-wallets-lp.html |
| ก๊อก test CCD | ขอ CCD ทดสอบฟรีในกระเป๋า (ได้ 20,000 CCD, ขอได้บัญชีละครั้ง) | https://docs.concordium.com/en/mainnet/tutorials/plt/request-ccd.html |
| ตัวอย่าง dApp | โค้ดตัวอย่างฝั่ง Concordium (มี `dapp-template`, `sponsoredTransactions`, `euroe-demo` ที่ใกล้เคียงร้านค้า + จ่าย stablecoin มากที่สุด) | https://github.com/Concordium/concordium-dapp-examples |
| ภาพรวมเทคโนโลยีเอเจนต์ | แผนที่ภาพรวม: โมเดลผูกตัวตน 4 แบบ, ใครเซ็นได้, x402, Protocol-Level Locks | https://www.concordium.com/build/ai-agent-technology |

**ข้อเท็จจริงที่เช็คแล้ว:**
- ป้ายคือ **token address ของ NFT CIS-8004** (มี 2 แบบ: สั้น Base58Check เช่น `Mf22soLh…` กับแบบเต็ม CAIP-19 `ccd:<genesis>/cis-2:<สั้น>`)
- ตรวจป้ายได้โดยไม่ต้องไว้ใจใคร: แกะป้าย → ถาม `agent_of(token_id)` บนเชน (ต้องได้สถานะ Active) → โหลด Agent Card แล้วเช็ค SHA-256 ว่าตรงกับ hash บนเชน → (ถ้ามี) เช็คกุญแจข้ามเชนผ่าน CIS-8
- โมเดลที่ใช้คือ **แบบ A: native บน Concordium** (ตัดสินใจ 15 พ.ย. 19:07 — ไม่ใช้ NEAR ในการลงทะเบียน) — ตัวตนที่ลงทะเบียนคือบัญชี Concordium ของ sydear, การจ่ายบิลยังรันบน NEAR เหมือนเดิม (เป็นแค่รางจ่ายเงิน ไม่ใช่ตัวตนที่ลงทะเบียน)
- **Protocol-Level Locks (PLL) ยังไม่มา** (เลื่อนเป็น 27 ม.ค. 2027) — อย่าวางแผนพึ่งมันในงานนี้
- ลงทะเบียนตัวแทนผ่านแอป Registry ตรงๆ **ฟรี** (ตามที่ concordium.com บอก) — ส่วนค่าธรรมเนียม 3 USDC ที่เห็นในเอกสารของ XDC AI นั้นเป็นของฝั่งตลาด XDC ไม่ใช่ของ Registry ตรงๆ (ต้องยืนยันอีกทีในเวิร์กชอป)
- เลขสัญญา Registry บน **mainnet**: CIS-8004 `<10082,0>`, CIS-8 `<10081,0>` — **แต่เลขบน testnet ยังไม่รู้ ต้องถามในเวิร์กชอปหรือดูในแอป Registry ตอนสลับเป็น testnet** (ห้ามเอาเลข mainnet ไปใช้บน testnet)

---

## 3. ภาพรวม — จะต่อกันยังไง

```
คนซื้อ (ลูกค้า/เอเจนต์อื่น)
   │  ① เปิดบิล BillSettle (NEAR testnet เหมือนเดิม)
   ▼
BillSettle (ตัวแทนจ่ายบิล)
   │  ② จ่ายบิลด้วย BSDD ผ่าน ft_transfer_call → บิลพลิกเป็น Paid + ใบเสร็จ (NEAR เหมือนเดิม)
   │
   │  ③ ป้าย Verified by Concordium โชว์บนหน้าบิล/ใบเสร็จ
   │     (กดดูได้: เจ้าของคือใคร, สถานะ Active ไหม, การ์ดตรงกับ hash บนเชนไหม)
   ▼
Concordium testnet (ชั้นตัวตน)
   • บัญชี sydear ยืนยันตัวตนแล้ว (ID + passport/liveness)
   • Agent Registry: BillSettle ลงทะเบียนแบบ native → ได้ NFT CIS-8004 → ได้ป้าย (badge string)
   • Agent Card: ไฟล์ JSON โฮสต์บน GitHub Pages, hash ปักไว้บนเชน
   • x402 (ส่วนเสริม): เอเจนต์อื่นจ่าย stablecoin เพื่อเรียกใช้บริการ BillSettle
     (เช่น ขอดูบิล/ใบเสร็จแบบยืนยันตัวตน) — จ่ายแล้วได้ของ, ตัวตนผู้จ่ายแนบไปด้วย
```

**เส้นแบ่งที่ต้องจำ:** NEAR = จ่ายเงินบิล · Concordium = พิสูจน์ว่ามีคนจริงรับผิดชอบ + ลงทะเบียนตัวแทน + จ่ายแบบเอเจนต์ต่อเอเจนต์ (x402)

---

## 4. ขั้นตอนทีละขั้น (ทำตามลำดับนี้)

### ขั้นที่ 0 — เตรียมของ (ทำได้เลยวันนี้, ไม่ต้องรอเวิร์กชอป)
- [ ] อ่านหน้าโปรแกรม + เอกสารตามตารางข้อ 2 (โดยเฉพาะภาพรวมเทคโนโลยีเอเจนต์ + หน้า Badge)
- [ ] ไฟล์นี้ (`INTEGRATION_PLAN.md`) + เทมเพลต Agent Card (`agent-card.template.json`) อยู่ใน `~/workspace/concordium-billsettle/` แล้ว
- [ ] ตัดสินใจ: ชื่อตัวแทนใน Registry = **BillSettle** (ตรงกับโปรเจกต์บน Encode Club)

### ขั้นที่ 1 — กระเป๋า + ตัวตน (sydear ทำเองเท่านั้น — ดูข้อ 6)
- [ ] ติดตั้ง **Concordium Browser Wallet** (Chrome) หรือ Mobile Wallet แล้วสร้างบัญชี **testnet**
- [ ] ขอ test CCD ฟรีในกระเป๋า (เมนู Activity → Request CCD ได้ 20,000 CCD บัญชีละครั้ง, เฉพาะบัญชีที่ยังไม่เคยรับเงินเข้า)
- [ ] ยืนยันตัวตนครั้งเดียว (**Concordium ID**): ทำใน Mobile Wallet ด้วยพาสปอร์ต + ถ่ายหน้าสด (liveness) ผ่านผู้ให้บริการยืนยันตัวตนอิสระ — ข้อมูลส่วนตัวไม่อยู่บนเชน
- [ ] จดที่อยู่บัญชี Concordium testnet ของตัวเองไว้ (เป็นแค่ที่อยู่บัญชี ไม่ใช่ seed phrase — seed phrase ห้ามให้ใครเห็น ห้ามพิมพ์ลงที่ไหน) — **ที่อยู่บัญชี testnet ของ sydear (สร้าง 15 พ.ย. 2026): `3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`**

### ขั้นที่ 2 — ลงทะเบียนตัวแทน BillSettle (sydear กดเองในแอป, Muse เตรียมข้อมูลให้)

> **ตัดสินใจ 15 พ.ย. 19:07 (sydear): ไม่ใช้ NEAR — ลงทะเบียนแบบ native บน Concordium ผ่านเว็บแอปตรงๆ (โมเดล A)** ที่มาคือเว็บแอปเลือก NEAR ไม่ได้ (ค้นหาได้ "No chains found", ปุ่ม NEAR ในรายการ MCP ถูกปิด) ต้องไปทาง MCP ซึ่งยุ่งยากกว่า เลยตัด NEAR ออกจากการลงทะเบียนไปเลย ไม่ต้องใช้ MCP client, ไม่ต้องหา public key NEAR, ไม่ต้องเซ็น CIS-8
- [ ] เปิด https://agent-registry.concordium.com/ สลับเครือข่ายเป็น **testnet** แล้วเชื่อมกระเป๋า — **ทำแล้ว 15 พ.ย. 18:40 เชื่อมต่อสำเร็จ บัญชี 3fFCiJ… (testnet dashboard: https://testnet-agent-registry.concordium.com/dashboard)**
- [x] เลือกโมเดล **A: native บน Concordium** — ลงทะเบียนด้วยบัญชี Concordium ของ sydear เอง (ไม่เลือกเชนอื่น) — **ทำแล้ว 15 พ.ย. 19:12**
- [ ] ใส่ Metadata URL ชี้ไป Agent Card JSON (ดูขั้นที่ 3) — **เว้นว่างไว้ตอนลงทะเบียน (การ์ดยังไม่โฮสต์) จะผูกทีหลังด้วย setAgentURI** — ฟอร์มบนเว็บไม่มีช่องชื่อ/คำอธิบาย/URL/repo ข้อมูลเหล่านั้นอยู่ใน Agent Card JSON ทั้งหมด
- [x] จดเลขสัญญา Registry บน testnet ที่แอปแสดง (CIS-8004) — **ยืนยันแล้ว: #12802 (native) — เลข 12756 ที่ขัดกันไม่ถูกใช้** — เอาไปใส่ใน Agent Card + โค้ด
- [x] ลงทะเบียน → ได้ **NFT CIS-8004 (token id 1185)** → นั่นคือ **ป้าย (badge string)** ทั้งแบบสั้นและแบบเต็ม CAIP-19 — **ทำแล้ว 15 พ.ย. 19:12, tx `8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e` (บล็อก 50843126, SUCCESS), ค่าธรรมเนียม 15.699899 CCD**
- [x] จดไว้: badge string (สั้น) `JyP9WvdiYC2ADhyQTirr5`, token id 1185, ที่อยู่บัญชีเจ้าของ 3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9, เลขสัญญา testnet #12802 — Agent ID (CAIP-19) `ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:JyP9WvdiYC2ADhyQTirr5` — ชื่อ "BillSettle" ยังไม่ปรากฏบนเชน (Metadata URL: N/A) ต้องโฮสต์การ์ด + ปัก hash ก่อนถึงจะขึ้น

### ขั้นที่ 3 — Agent Card (Muse ทำให้, sydear ตรวจ)
- [ ] เขียน Agent Card (ไฟล์ JSON) จากเทมเพลต `agent-card.template.json` โดยใส่ค่าจริงจากขั้นที่ 2: ชื่อ BillSettle, คำอธิบาย, จุดบริการ (URL เดโม), ป้าย (extension `https://docs.concordium.com/a2a-extensions/concordium-badge/v1`), `registrations` (ERC-8004), และ external reference ไปยังสัญญา NEAR (billsettle-bills.testnet / billsettle-token.testnet) ในฐานะรางจ่ายบิล — เป็นแค่ข้อมูลอ้างอิง ไม่ใช่การผูกตัวตนด้วย CIS-8
- [ ] โฮสต์การ์ดที่ `https://techfrontiers.github.io/billsettle/.well-known/agent-card.json` (ไฟล์อยู่ใน repo ตรง `docs/.well-known/agent-card.json`) — **ต้องเพิ่มไฟล์ `docs/.nojekyll` (ไฟล์ว่าง) ด้วย ไม่งั้น GitHub Pages จะไม่เสิร์ฟโฟลเดอร์ที่ขึ้นต้นด้วยจุด**
- [ ] คำนวณ SHA-256 ของไฟล์การ์ดตามที่เสิร์ฟจริง (`curl -s <url> | sha256sum`) แล้วปัก hash ไว้บนเชนด้วย `setAgentURI` (ผ่านเครื่องมือ MCP `build-set-agent-uri` หรือในแอป Registry) — ระหว่างโฮสต์กับปัก hash การ์ดกับ hash จะไม่ตรงกันชั่วครู่ วิธีเลี่ยงคือโฮสต์ที่ URL ใหม่แบบมีเวอร์ชันแล้วส่ง `agent_uri` + hash พร้อมกันในธุรกรรมเดียว — **ตอนเซ็น หน้าต่างอนุมัติอาจเด้งบนมือถือ (Mobile Wallet) ไม่ใช่ในเบราว์เซอร์ — ดูมือถือด้วย**
- [ ] ตรวจ: `GET https://agent-registry-mcp.concordium.com/v1/check-badge/<badgeสั้น>` ต้องได้ `badge_valid`, `extension_conformant`, `verification_present` เป็น true ทั้งหมด และ `issues` ว่าง

### ขั้นที่ 4 — โชว์ป้ายบนหน้า BillSettle (Muse ทำให้)
- [ ] ไฟล์ที่แก้: `docs/index.html` + `docs/app.js` (repo Techfrontiers/billsettle) — **ไม่แตะสัญญา NEAR**
- [ ] เพิ่มในหน้าเว็บ: โลโก้ "Verified by Concordium" + badge string (แบบสั้น) บนหน้าบิล / แดชบอร์ด / ใบเสร็จ — โลโก้ต้องลิงก์ไปที่ badge ที่ resolve แล้ว และต้องแสดง badge string คู่กันเสมอ (โลโก้อย่างเดียวคือแค่คำอ้าง ตัวอักษรป้ายคือหลักฐาน)
- [ ] เพิ่มฟังก์ชัน `verifyBadge()`: เรียก `GET https://agent-registry-mcp.concordium.com/v1/badge-check/<badgeสั้น>?network=testnet` แล้วโชว์สถานะ (Active / เจ้าของ / hash ตรงไหม) บนหน้าเว็บ — อันนี้คือสิ่งที่กรรมการและผู้ใช้เห็นจริง
- [ ] บนใบเสร็จ: เพิ่มลิงก์ CCDExplorer (ธุรกรรม/ตัวแทนบน Concordium testnet) คู่กับลิงก์ NEAR Explorer เดิม

### ขั้นที่ 5 — x402 (ส่วนเสริม — ทำหลังขั้น 1–4 เสร็จ)
- [ ] แนวทาง: **ไม่รื้อรางจ่ายบิลของ NEAR** — ให้ x402 เป็นชั้น "เอเจนต์อื่นจ่ายเพื่อเรียกใช้บริการ BillSettle" แทน เช่น เอเจนต์อื่นขอดูบิล/ใบเสร็จที่ยืนยันตัวตนแล้ว → เซิร์ฟเวอร์ตอบ 402 พร้อมราคา → เอเจนต์จ่าย stablecoin บน Concordium testnet พร้อมแนบตัวตนที่ยืนยันแล้ว → ได้ข้อมูล/ใบเสร็จ
- [ ] ต้องรู้ก่อนทำ (ถามเวิร์กชอป): บน testnet ใช้ stablecoin ตัวไหน, facilitator/SDK ตัวไหน, และท่า 402 ที่ถูกต้องของ Concordium
- [ ] ถ้า x402 บน testnet ติดขัด: ตัดออกได้ — ป้าย + Registry + การ์ด อย่างเดียวก็ผ่านเกณฑ์ "ใช้ Concordium component อย่างมีความหมาย" แล้ว (อย่าฝืนจนงานหลักพัง)

### ขั้นที่ 6 — เดโม + ส่งงาน (Muse ทำให้, sydear ตรวจและกดส่ง)
- [ ] เดโมวิดีโอ ≤3 นาที: โชว์วงจรเต็ม — เปิดบิล → เห็นป้าย Verified → จ่ายบิล (NEAR) → บิลพลิกเป็น Paid → ใบเสร็จมีทั้งลิงก์ NEAR Explorer และ CCDExplorer + สถานะป้าย Active
- [ ] คำอธิบายส่งงาน: สร้างอะไร, ทำงานยังไง, ใช้ Concordium ชิ้นไหนบ้าง, ลิงก์ CCDExplorer ของตัวแทน/ธุรกรรม, แผนไป production (mainnet + ผู้ใช้จริง)
- [ ] อัปเดต README ของ repo BillSettle เพิ่มส่วน Concordium
- [ ] ส่งจากหน้าโปรเจกต์บน Encode Club ภายใน **10 ธ.ค. 06:59 น.** (เวลาไทย) — ส่งเร็ว อย่ารอเส้นตาย (แพลตฟอร์มล็อกตอนเส้นตาย)

---

## 5. คำถามที่ต้องยืนยันในเวิร์กชอป (จันทร์ 16 พ.ย. 22:00 / อังคาร 18 พ.ย. 22:00)

1. **เลขสัญญา Registry บน testnet คืออะไร** (CIS-8004 / CIS-8 index + subindex) และ genesis hash ของ testnet (สำหรับทำ badge แบบ CAIP-19)?
2. ~~**ผูกกุญแจ NEAR ด้วย CIS-8 ได้ไหม**~~ — **ตัดออกแล้ว (ตัดสินใจ 15 พ.ย. 19:07: ไม่ใช้ NEAR)** — ไม่ต้องถามข้อนี้แล้ว
3. **ลงทะเบียนตรงผ่านแอป Registry ฟรีจริงไหม** (บน testnet) — มีค่าธรรมเนียมแอบแฝงไหม (เช่น 3 USDC แบบฝั่ง XDC)?
4. **x402 บน testnet**: ใช้ stablecoin ตัวไหน, facilitator/SDK ตัวไหน, ท่า 402 ที่ถูกต้องคืออะไร?
5. **MCP server บน testnet**: endpoint คืออะไร (mainnet คือ `https://agent-registry-mcp.concordium.com/mcp` — testnet ใช้ตัวเดียวกันแล้วใส่ `?network=testnet` หรือแยก endpoint)?
6. **Agent Card**: แอป Registry คาดหวังฟิลด์อะไรบ้างเป็นขั้นต่ำ (นอกเหนือจาก badge extension)? มีเทมเพลต/ตัวอย่างการ์ดของเอเจนต์ที่อยู่เชนอื่นให้ดูไหม?
7. **การยืนยันตัวตน (Concordium ID) บน testnet**: ทำผ่าน Mobile Wallet เหมือน mainnet ไหม ต้องใช้พาสปอร์ตจริงไหม หรือ testnet มีทางลัด?

---

## 6. ใครทำอะไร — แบ่งงานชัดๆ

### sydear ต้องทำเองเท่านั้น (Muse แตะไม่ได้)
- สร้างกระเป๋า Concordium testnet ของตัวเอง (Browser Wallet / Mobile Wallet) — **seed phrase อยู่กับมึงคนเดียว ห้ามพิมพ์ ห้ามส่ง ห้ามเก็บไว้ที่ไหนที่ Muse เห็น**
- ยืนยันตัวตนครั้งเดียว (พาสปอร์ต + หน้าสด ใน Mobile Wallet) — มีแค่มึงที่ทำได้
- ขอ test CCD จากก๊อกในกระเป๋าตัวเอง
- กดลงทะเบียนตัวแทน + เซ็นธุรกรรมในกระเป๋าตัวเอง (Muse เตรียมค่าทุกอย่างไว้ให้ แต่มึงเป็นคนกด)
- เข้าเวิร์กชอป จันทร์/อังคาร 22:00 (หรือดูย้อนหลัง)
- ตรวจและกดส่งงานสุดท้ายบน Encode Club

### Muse ทำให้ได้
- Agent Card (เขียนไฟล์ JSON + คำนวณ hash + เตรียมคำสั่งปัก hash)
- แก้หน้าเว็บ BillSettle (`docs/index.html`, `docs/app.js`): โชว์ป้าย, ตรวจป้ายสดผ่าน MCP, ลิงก์ CCDExplorer
- สเกตช์/โค้ด x402 ส่วนเสริม (หลังได้คำตอบจากเวิร์กชอป)
- เดโมวิดีโอ (≤3 นาที), คำอธิบายส่งงาน, แผนไป production, อัปเดต README
- ตรวจด้วยเครื่องมือสาธารณะ (badge-check, CCDExplorer) — ไม่ต้องใช้กุญแจของใคร

---

## 7. ห้ามทำ (เส้นแดง)

- **ห้าม** สร้าง / จัดการ / พิมพ์ / เก็บ seed phrase หรือ private key — กระเป๋าเป็นของ sydear คนเดียว
- **ห้าม** deploy อะไรขึ้น mainnet — งานนี้ testnet เท่านั้น
- **ห้าม** แก้สัญญา NEAR ที่ deploy แล้ว (`billsettle-bills.testnet`, `billsettle-token.testnet`) — มันถูกห้ามแก้และกำลังใช้ในเดโม
- **ห้าม** ส่งอะไรไป Encode Club ก่อน sydear ตรวจและสั่ง
- **ห้าม** เอาเลขสัญญา mainnet (CIS-8004 `<10082,0>`, CIS-8 `<10081,0>`) ไปใช้บน testnet
- **ห้าม** วางแผนพึ่ง Protocol-Level Locks (ยังไม่มา เลื่อนเป็น ม.ค. 2027)

---

## 8. ลิงก์เอกสารทั้งหมด (เช็คแล้ว 15 พ.ย. 2026)

- โปรแกรม: https://www.encodeclub.com/programmes/concordium-trusted-agents-hackathon
- บทความ Concordium: https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club
- Developer hub: https://www.concordium.com/build/developer
- ภาพรวมเทคโนโลยีเอเจนต์: https://www.concordium.com/build/ai-agent-technology
- Agent Registry (แอป): https://agent-registry.concordium.com/
- Agent Registry (เอกสารเทคนิค): https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/index.html
- ป้าย Verified by Concordium: https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/concordium-badge.html
- ข้อกำหนด CIS-8004: https://proposals.concordium.com/CIS/cis-8004.html
- ตั้งค่ากระเป๋า: https://docs.concordium.com/en/mainnet/technical-reference/wallets/guides/setup-wallets-lp.html
- ขอ test CCD: https://docs.concordium.com/en/mainnet/tutorials/plt/request-ccd.html
- x402 อธิบาย: https://www.concordium.com/article/x402-explained-agentic-payments-identity
- x402 + ยืนยันอายุ: https://www.concordium.com/article/concordium-brings-native-age-verification-to-agentic-payments-with-x402
- Agent-to-Agent Settlement: https://www.concordium.com/agent-to-agent-settlement
- MCP server: https://agent-registry-mcp.concordium.com/mcp
- ตรวจป้าย (REST): https://agent-registry-mcp.concordium.com/v1/badge-check/<badgeสั้น>?network=testnet
- ตัวอย่าง dApp: https://github.com/Concordium/concordium-dapp-examples
- BillSettle (repo): https://github.com/Techfrontiers/billsettle
- BillSettle (เดโม): https://techfrontiers.github.io/billsettle/
- CCDExplorer: https://ccdexplorer.io

---

## 9. กำหนดการ

| วัน | อะไร |
|---|---|
| ส. 15 พ.ย. | แผนนี้ + เทมเพลต Agent Card เสร็จ |
| จ. 16 พ.ย. 09:41 | เทสต์ Presage SDK (งานอื่นที่ตั้งไว้แล้ว — ทำก่อน) |
| จ. 16 พ.ย. 22:00 | เวิร์กชอป Concordium "Ship to production without crypto" — เอาคำถามข้อ 5 ไปถาม |
| อ. 18 พ.ย. 22:00 | เวิร์กชอป "Plug into the agent stack you already use" |
| พ. 19 พ.ย. | เปิดหน้าต่างสร้างของ (build window) — เริ่มขั้นที่ 1–4 จริงจัง |
| ส. 22 พ.ย. | Checkpoint 1 (สร้างโปรเจกต์) — ทำเสร็จแล้วตั้งแต่ 15 พ.ย. |
| 24 พ.ย.–8 ธ.ค. | Office hours อังคาร/ศุกร์ 15:00 UTC — ถามปัญหาที่ติด |
| พ. 9 ธ.ค. 23:59 UTC | ปิดรับงาน = **พฤ. 10 ธ.ค. 06:59 น. เวลาไทย** |
| พฤ.–ศ. 10–11 ธ.ค. | กรรมการตัดสิน |

---

## 10. สิ่งที่เสี่ยงที่สุด (รู้ไว้ก่อน)

**เลขสัญญา Registry บน testnet ขัดกันในแอป** (CIS-8004 12756 vs ส่วนหัว 12802) — ต้องยืนยันเลขที่ถูกต้องตอนลงทะเบียนจริง ไม่งั้นป้าย/การ์ดจะอ้างเลขผิด ส่วนความเสี่ยงเดิม (ผูกกุญแจ NEAR ด้วย CIS-8) **หมดไปแล้ว** เพราะตัดสินใจลงทะเบียนแบบ native (โมเดล A) ตั้งแต่ 15 พ.ย. 19:07
