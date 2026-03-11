const meter = 40
const CHAIR_SIZE = 0.2 * meter
const CHAIR_MARGIN = 0.1 * meter
const MOVE_STEP = 0.01 * meter
const ROTATE_STEP = 10

const hallWidth = 26 * meter
const hallHeight = 30 * meter

const canvas = new fabric.Canvas("canvas", { selection: true })

let mainEl = document.querySelector("main")
function resizeCanvas() {
    const rect = mainEl.getBoundingClientRect()
    canvas.setWidth(rect.width)
    canvas.setHeight(rect.height)
    clampViewport()
    fitToScreen()
    canvas.requestRenderAll()
}
window.addEventListener("resize", resizeCanvas)

let gridVisible = false
let gridGroup = null

let tableNumber = 1
let totalSeats = 0
let totalTables = 0
let totalReservedTables = 0
let totalReservedSeats = 0
let isDragging = false
let lastPosX = 0
let lastPosY = 0
let spacePressed = false
const minZoom = 0.2
const maxZoom = 4
canvas.wrapperEl.addEventListener("contextmenu", (e) => e.preventDefault())
const PAN_THRESHOLD = 4
let maybePanning = false
let panStarted = false
initTheme()

//--------------------------------
// تحميل صورة القاعة
//--------------------------------

fabric.Image.fromURL("mm.jpeg", (img) => {

    const sx = hallWidth / img.width
    const sy = hallHeight / img.height
    canvas.setBackgroundImage(
        img,
        canvas.renderAll.bind(canvas),
        {
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            scaleX: sx,
            scaleY: sy
        }
    )

    resizeCanvas()
    fitToScreen()
})

//--------------------------------
// رسم الشبكة
//--------------------------------

function drawGrid() {

    if (gridGroup) {
        canvas.remove(gridGroup)
        gridGroup = null
    }

    let lines = []

    for (let i = 0; i <= 26; i++) {
        lines.push(new fabric.Line(
            [i * meter, 0, i * meter, hallHeight],
            { stroke: "#ccc", selectable: false, evented: false }
        ))
    }

    for (let i = 0; i <= 30; i++) {
        lines.push(new fabric.Line(
            [0, i * meter, hallWidth, i * meter],
            { stroke: "#ccc", selectable: false, evented: false }
        ))
    }

    gridGroup = new fabric.Group(lines, {
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        excludeFromExport: true
    })

    gridGroup.clipPath = new fabric.Rect({
        left: 0,
        top: 0,
        width: hallWidth,
        height: hallHeight,
        absolutePositioned: true
    })

    canvas.add(gridGroup)
    canvas.sendToBack(gridGroup)
    canvas.requestRenderAll()

}

function toggleGrid() {

    gridVisible = !gridVisible

    if (gridVisible) {

        drawGrid()

    } else {

        if (gridGroup) {
            canvas.remove(gridGroup)
            gridGroup = null
        }

    }

    canvas.renderAll()

}

//--------------------------------
// كرسي
//--------------------------------

function chair(x, y) {

    return new fabric.Rect({

        left: x,
        top: y,
        width: CHAIR_SIZE,
        height: CHAIR_SIZE,

        fill: "#666",

        originX: "center",
        originY: "center"

    })

}

//--------------------------------
// إضافة طاولة
//--------------------------------

function getNextAvailableTableNumber() {
    const used = new Set()
    canvas.getObjects().forEach(o => {
        if (o.tableGroup || o.name === "table") {
            if (typeof o.tableNumber === "number") {
                used.add(o.tableNumber)
            } else if (o._objects && Array.isArray(o._objects)) {
                const t = o._objects.find(x => x.type === "text")
                if (t && t.text) {
                    const n = parseInt(String(t.text), 10)
                    if (!isNaN(n)) used.add(n)
                }
            }
        }
    })
    let n = 1
    while (used.has(n)) n++
    return n
}

function addTable(lengthCM, seats) {

    let widthCM = 80

    let tableWidth = (lengthCM / 100) * meter
    let tableHeight = (widthCM / 100) * meter
    let dd = document.getElementById("addDropdown")
    if (dd) dd.classList.remove("open")

    const num = getNextAvailableTableNumber()

    let table = new fabric.Rect({

        width: tableWidth,
        height: tableHeight,

        fill: "#fff",
        stroke: "#000",

        originX: "center",
        originY: "center"

    })

    let number = new fabric.Text(String(num), {

        fontSize: 16,
        originX: "center",
        originY: "center",
        name: "tableNumber"

    })

    let objects = [table, number]

    // توزيع الكراسي

    let sideSeats = Math.floor(seats / 2)
    let chairOffset = (CHAIR_MARGIN - CHAIR_SIZE / 2)

    for (let i = 0; i < sideSeats; i++) {

        let pos = -tableWidth / 2 + (i + 1) * (tableWidth / (sideSeats + 1))

        objects.push(chair(pos, -tableHeight / 2 - chairOffset))
        objects.push(chair(pos, tableHeight / 2 + chairOffset))

    }

    let group = new fabric.Group(objects, {

        left: hallWidth / 2,
        top: hallHeight / 2,

        lockScalingX: true,
        lockScalingY: true

    })

    group.name = "table"
    group.tableNumber = num
    makeTableGroup(group)

    canvas.add(group)

    tableNumber = Math.max(tableNumber, num + 1)

    recalcStats()

}

//--------------------------------
// الإحصائيات
//--------------------------------

function updateStats() {

    document.getElementById("seatCount").innerText = totalSeats
    document.getElementById("tableCount").innerText = totalTables
    const rt = document.getElementById("reservedTableCount")
    const rs = document.getElementById("reservedSeatCount")
    if (rt) rt.innerText = totalReservedTables
    if (rs) rs.innerText = totalReservedSeats

}

//--------------------------------
// zoom
//--------------------------------

function zoomIn() {

    const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2)
    let z = Math.min(maxZoom, canvas.getZoom() * 1.1)
    canvas.zoomToPoint(center, z)
    clampViewport()
    canvas.requestRenderAll()

}

function zoomOut() {

    const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2)
    let z = Math.max(minZoom, canvas.getZoom() * 0.9)
    canvas.zoomToPoint(center, z)
    clampViewport()
    canvas.requestRenderAll()

}

//--------------------------------
// حفظ
//--------------------------------

function saveDesign() {

    let json = JSON.stringify(canvas.toJSON(["name", "tableNumber", "reserved", "info"]))

    localStorage.setItem("hallDesign", json)

    alert(t("saved"))

}

//--------------------------------
// تحميل
//--------------------------------

function loadDesign() {

    let data = localStorage.getItem("hallDesign")

    if (!data) return

    canvas.loadFromJSON(
        data,
        function () {
            fixupLoadedTables()
            recalcStats()
            canvas.requestRenderAll()
        },
        function (o, object) {
            if (object && object.type === "group") {
                let isTable = !!(object.name === "table" || object.tableGroup)
                if (!isTable) {
                    const arr = object._objects || object.objects
                    if (arr && Array.isArray(arr)) {
                        const hasRect = arr.some(x => x.type === "rect")
                        const txt = arr.find(x => x.type === "text")
                        if (hasRect && txt) {
                            object.name = "table"
                            if (typeof object.tableNumber !== "number") {
                                const n = parseInt(String(txt.text), 10)
                                if (!isNaN(n)) object.tableNumber = n
                            }
                            isTable = true
                        }
                    }
                }
                if (isTable) {
                    makeTableGroup(object)
                }
            }
        }
    )

}

//--------------------------------
// صورة
//--------------------------------

function _dataURLtoBlob(dataurl) {
    const arr = dataurl.split(",")
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    return new Blob([u8arr], { type: mime })
}

async function exportImage() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const hasMsSave = typeof navigator !== "undefined" && typeof navigator.msSaveOrOpenBlob === "function"
    const prev = canvas.viewportTransform ? canvas.viewportTransform.slice() : null
    const tryPicker = async (blob) => {
        if (!('showSaveFilePicker' in window)) return false
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: "hall.png",
                types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }]
            })
            const writable = await handle.createWritable()
            await writable.write(blob)
            await writable.close()
            return true
        } catch (e) {
            return false
        }
    }
    try {
        fitToScreen()
        canvas.requestRenderAll()
        await new Promise(r => requestAnimationFrame(r))
        const data = canvas.toDataURL({ format: "png", quality: 1, multiplier: 2 })
        const blob = _dataURLtoBlob(data)
        if (prev) {
            canvas.viewportTransform = prev
            canvas.requestRenderAll()
        }
        if (await tryPicker(blob)) return
        if (hasMsSave) {
            navigator.msSaveOrOpenBlob(blob, "hall.png")
            return
        }
        const url = URL.createObjectURL(blob)
        if (isIOS) {
            window.open(url, "_blank")
            setTimeout(() => URL.revokeObjectURL(url), 2000)
            return
        }
        const a = document.createElement("a")
        a.href = url
        a.download = "hall.png"
        a.style.display = "none"
        document.body.appendChild(a)
        a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
        setTimeout(() => {
            URL.revokeObjectURL(url)
            a.remove()
        }, 0)
    } catch (e) {
        try {
            const data = canvas.toDataURL({ format: "png", quality: 1 })
            const win = window.open()
            if (win) win.document.write('<img src="' + data + '" />')
        } catch (_) { }
    } finally {
        if (prev) {
            canvas.viewportTransform = prev
            canvas.requestRenderAll()
        }
    }
}

function clampViewport() {
    let vpt = canvas.viewportTransform
    if (!vpt) return
    let zoom = canvas.getZoom()
    let w = canvas.getWidth()
    let h = canvas.getHeight()
    let worldW = hallWidth * zoom
    let worldH = hallHeight * zoom
    if (worldW <= w) {
        vpt[4] = (w - worldW) / 2
    } else {
        vpt[4] = Math.min(0, Math.max(w - worldW, vpt[4]))
    }
    if (worldH <= h) {
        vpt[5] = (h - worldH) / 2
    } else {
        vpt[5] = Math.min(0, Math.max(h - worldH, vpt[5]))
    }
}

function fitToScreen() {
    let w = canvas.getWidth()
    let h = canvas.getHeight()
    let scale = Math.min(w / hallWidth, h / hallHeight) * 0.98
    if (!isFinite(scale) || scale <= 0) return
    canvas.setZoom(scale)
    canvas.viewportTransform[4] = (w - hallWidth * scale) / 2
    canvas.viewportTransform[5] = (h - hallHeight * scale) / 2
    canvas.requestRenderAll()
}

function resetView() {
    if (!confirm("هل تريد مسح جميع الطاولات وإعادة الملاءمة؟")) return
    canvas.discardActiveObject()
    canvas.getObjects().slice().forEach(o => {
        if (o.tableGroup || o.name === "table") {
            canvas.remove(o)
        }
    })
    tableNumber = 1
    totalTables = 0
    totalSeats = 0
    totalReservedTables = 0
    totalReservedSeats = 0
    updateStats()
    fitToScreen()
}

function isTypingInInput(e) {
    const t = e.target
    if (!t || !t.tagName) return false
    const tag = t.tagName.toUpperCase()
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
    return !!t.isContentEditable
}

document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        if (isTypingInInput(e)) return
        if (!spacePressed) {
            spacePressed = true
            canvas.wrapperEl.classList.add("grab")
        }
        e.preventDefault()
    }
})

document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
        if (isTypingInInput(e)) return
        spacePressed = false
        canvas.wrapperEl.classList.remove("grab")
    }
})

canvas.on("mouse:down", (opt) => {
    const e = opt.e
    const hasTarget = !!opt.target
    const startPanWithLeftOnModifier = (e.button === 0 && (e.ctrlKey || e.metaKey) && !hasTarget)
    const startPanWithLeftOnEmpty = ((e.button === 0 && !hasTarget) || (e.type === "touchstart" && !hasTarget))
    const startPan = (e.button === 1 || e.button === 2 || spacePressed || startPanWithLeftOnModifier || startPanWithLeftOnEmpty)
    if (startPan) {
        maybePanning = true
        panStarted = false
        const p = getClientXY(e)
        lastPosX = p.x
        lastPosY = p.y
        canvas.selection = false
        e.preventDefault && e.preventDefault()
        e.stopPropagation && e.stopPropagation()
    } else {
        maybePanning = false
        panStarted = false
        canvas.selection = true
        canvas.skipTargetFind = false
    }
})

canvas.on("mouse:move", (opt) => {
    if (!maybePanning) return
    const e = opt.e
    const p = getClientXY(e)
    if (!panStarted) {
        const dx = p.x - lastPosX
        const dy = p.y - lastPosY
        if (Math.hypot(dx, dy) < PAN_THRESHOLD) {
            return
        }
        panStarted = true
        canvas.skipTargetFind = true
        canvas.discardActiveObject()
        canvas.wrapperEl.classList.add("grabbing")
    }
    canvas.relativePan(new fabric.Point(p.x - lastPosX, p.y - lastPosY))
    lastPosX = p.x
    lastPosY = p.y
    clampViewport()
    canvas.requestRenderAll()
    e.preventDefault && e.preventDefault()
    e.stopPropagation && e.stopPropagation()
})

canvas.on("mouse:up", () => {
    maybePanning = false
    panStarted = false
    canvas.selection = true
    canvas.skipTargetFind = false
    canvas.setViewportTransform(canvas.viewportTransform)
    canvas.wrapperEl.classList.remove("grabbing")
})

canvas.on("mouse:wheel", (opt) => {
    let delta = opt.e.deltaY
    let zoom = canvas.getZoom()
    zoom *= Math.pow(0.999, delta)
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom))
    const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY)
    canvas.zoomToPoint(point, zoom)
    clampViewport()
    opt.e.preventDefault()
    opt.e.stopPropagation()
})

let _pinchActive = false
let _pinchStartDist = 0
let _pinchStartZoom = 1

function _getPinchDistance(e) {
    if (!e.touches || e.touches.length < 2) return 0
    const x = e.touches[0].clientX - e.touches[1].clientX
    const y = e.touches[0].clientY - e.touches[1].clientY
    return Math.hypot(x, y)
}

function _getPinchCenterPoint(e) {
    const rect = canvas.upperCanvasEl.getBoundingClientRect()
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
    return new fabric.Point(cx, cy)
}

canvas.wrapperEl.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 2) {
        _pinchActive = true
        _pinchStartDist = _getPinchDistance(e)
        _pinchStartZoom = canvas.getZoom()
        canvas.selection = false
        canvas.skipTargetFind = true
        e.preventDefault()
    }
}, { passive: false })

canvas.wrapperEl.addEventListener("touchmove", (e) => {
    if (!_pinchActive || !e.touches || e.touches.length !== 2) return
    const dist = _getPinchDistance(e)
    if (!_pinchStartDist) return
    let newZoom = _pinchStartZoom * (dist / _pinchStartDist)
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom))
    const center = _getPinchCenterPoint(e)
    canvas.zoomToPoint(center, newZoom)
    clampViewport()
    canvas.requestRenderAll()
    e.preventDefault()
}, { passive: false })

canvas.wrapperEl.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
        _pinchActive = false
        canvas.selection = true
        canvas.skipTargetFind = false
    }
}, { passive: false })

function clampObjectInsideHall(obj) {
    const W = obj.width * obj.scaleX
    const H = obj.height * obj.scaleY
    const a = (obj.angle % 360) * Math.PI / 180
    const bw = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))
    const bh = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a))
    const center = obj.getCenterPoint()
    let cx = center.x
    let cy = center.y
    const halfW = bw / 2
    const halfH = bh / 2
    if (cx - halfW < 0) cx = halfW
    if (cx + halfW > hallWidth) cx = hallWidth - halfW
    if (cy - halfH < 0) cy = halfH
    if (cy + halfH > hallHeight) cy = hallHeight - halfH
    obj.setPositionByOrigin(new fabric.Point(cx, cy), "center", "center")
    obj.setCoords()
}

function hasOverlap(obj) {
    const objs = canvas.getObjects().filter(o => o !== obj && (o.tableGroup || o.name === "table"))
    obj.setCoords()
    for (const o of objs) {
        o.setCoords()
        if (obj.intersectsWithObject(o) || o.intersectsWithObject(obj)) {
            return true
        }
        const r1 = obj.getBoundingRect(true)
        const r2 = o.getBoundingRect(true)
        const noOverlap = r2.left > r1.left + r1.width ||
            r2.left + r2.width < r1.left ||
            r2.top > r1.top + r1.height ||
            r2.top + r2.height < r1.top
        if (!noOverlap) return true
    }
    return false
}

function getClientXY(e) {
    if (e && e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    if (e && e.changedTouches && e.changedTouches.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
}

function makeTableGroup(group) {
    group.tableGroup = true
    group.lockScalingX = true
    group.lockScalingY = true
    group.lockUniScaling = true
    group.lockSkewingX = true
    group.lockSkewingY = true
    if (group.setControlsVisibility) {
        group.setControlsVisibility({
            tl: false, tr: false, bl: false, br: false,
            ml: false, mr: false, mt: false, mb: false,
            mtr: true
        })
    }
    const toHide = ["tl", "tr", "bl", "br", "ml", "mr", "mt", "mb"]
    toHide.forEach(k => {
        if (group.controls && group.controls[k]) {
            group.controls[k].visible = false
        }
    })
    if (group.controls && group.controls.mtr) {
        group.controls.mtr.visible = true
    }
    if (typeof group.tableNumber !== "number") {
        let txt = null
        if (group._objects && Array.isArray(group._objects)) {
            txt = group._objects.find(x => x.type === "text")
            if (txt && !txt.name) txt.name = "tableNumber"
        }
        if (txt && txt.text) {
            const n = parseInt(String(txt.text), 10)
            if (!isNaN(n)) group.tableNumber = n
        }
    }
    if (typeof group.reserved !== "boolean") {
        group.reserved = false
    }
    updateTableReservationAppearance(group)
    applyTableLockState(group)
    group._lastGood = { left: group.left, top: group.top, angle: group.angle }
    group.off("mousedown")
    group.off("moving")
    group.off("rotating")
    group.on("mousedown", function () {
        group._lastGood = { left: group.left, top: group.top, angle: group.angle }
    })
    group.on("moving", function () {
        group.left = Math.round(group.left / MOVE_STEP) * MOVE_STEP
        group.top = Math.round(group.top / MOVE_STEP) * MOVE_STEP
        clampObjectInsideHall(group)
        group.setCoords()
        group._lastGood = { left: group.left, top: group.top, angle: group.angle }
    })
    group.on("rotating", function () {
        let snapped = Math.round(group.angle / ROTATE_STEP) * ROTATE_STEP
        group.rotate(snapped)
        clampObjectInsideHall(group)
        group.setCoords()
        group._lastGood = { left: group.left, top: group.top, angle: group.angle }
    })
}

function fixupLoadedTables() {
    canvas.getObjects().forEach(o => {
        if (o.type === "group" && (o.name === "table" || o.tableGroup)) {
            makeTableGroup(o)
        }
    })
}

canvas.on("object:scaling", (opt) => {
    const t = opt.target
    if (!t) return
    if (t.name === "table" || t.tableGroup) {
        t.scaleX = 1
        t.scaleY = 1
        t.setCoords()
        canvas.requestRenderAll()
    }
})

function deleteSelectedTable() {
    let obj = canvas.getActiveObject()
    if (!obj) return
    let target = obj
    if (obj.type !== "group" && obj.group) target = obj.group
    if (target && (target.tableGroup || target.name === "table")) {
        canvas.remove(target)
        recalcStats()
        canvas.requestRenderAll()
    }
}

function recalcStats() {
    let tables = 0
    let seats = 0
    let rTables = 0
    let rSeats = 0
    canvas.getObjects().forEach(o => {
        if (o.tableGroup || o.name === "table") {
            tables++
            let n = 0
            if (o._objects && Array.isArray(o._objects)) n = o._objects.length
            else if (o.objects && Array.isArray(o.objects)) n = o.objects.length
            else if (typeof o.size === "function") n = o.size()
            let chairs = Math.max(0, n - 2)
            seats += chairs
            if (o.reserved) {
                rTables++
                rSeats += chairs
            }
        }
    })
    totalTables = tables
    totalSeats = seats
    totalReservedTables = rTables
    totalReservedSeats = rSeats
    updateStats()
}

function getTableRect(group) {
    if (!group) return null
    if (group._objects && Array.isArray(group._objects)) {
        const r = group._objects.find(x => x.type === "rect")
        if (r) return r
    }
    if (group.objects && Array.isArray(group.objects)) {
        const r = group.objects.find(x => x.type === "rect")
        if (r) return r
    }
    return null
}

function updateTableReservationAppearance(group) {
    const r = getTableRect(group)
    if (!r) return
    if (group.reserved) {
        r.set({ fill: "#ffe0e0", stroke: "#c00" })
    } else {
        r.set({ fill: "#fff", stroke: "#000" })
    }
    group.setCoords()
    canvas.requestRenderAll()
}

function applyTableLockState(group) {
    if (!group || (!group.tableGroup && group.name !== "table")) return
    const locked = !!group.reserved
    group.lockMovementX = locked
    group.lockMovementY = locked
    group.lockRotation = locked
    if (group.controls && group.controls.mtr) {
        group.controls.mtr.visible = !locked
    }
    group.setCoords()
    canvas.requestRenderAll()
}

function updateReserveButtonUI() {
    const btn = document.getElementById("reserveBtn")
    if (!btn) return
    const ic = btn.querySelector(".ic")
    const lb = btn.querySelector(".lb")
    const obj = canvas.getActiveObject()
    let group = obj
    if (obj && obj.type !== "group" && obj.group) group = obj.group
    const valid = group && (group.tableGroup || group.name === "table")
    btn.disabled = !valid
    if (!valid) {
        if (ic) ic.textContent = "🔓"
        if (lb) lb.textContent = t("reserve")
        btn.style.color = ""
        btn.title = t("reserveTitle")
        return
    }
    if (group.reserved) {
        if (ic) ic.textContent = "🔒"
        if (lb) lb.textContent = t("reserved")
        btn.style.color = "#c00"
        btn.title = t("unreserveTitle")
    } else {
        if (ic) ic.textContent = "🔓"
        if (lb) lb.textContent = t("reserve")
        btn.style.color = "#0a0"
        btn.title = t("reserveTitle")
    }
}

function setReservation(group, value) {
    group.reserved = !!value
    updateTableReservationAppearance(group)
    applyTableLockState(group)
    updateReserveButtonUI()
    updateInfoFormUI()
    recalcStats()
}

function toggleReservationForSelectedTable() {
    const obj = canvas.getActiveObject()
    if (!obj) return
    let group = obj
    if (obj.type !== "group" && obj.group) group = obj.group
    if (group && (group.tableGroup || group.name === "table")) {
        setReservation(group, !group.reserved)
    }
}

canvas.on("selection:created", () => updateReserveButtonUI())
canvas.on("selection:updated", () => updateReserveButtonUI())
canvas.on("selection:cleared", () => updateReserveButtonUI())
canvas.on("selection:created", () => updateInfoFormUI())
canvas.on("selection:updated", () => updateInfoFormUI())
canvas.on("selection:cleared", () => updateInfoFormUI())

function getSelectedTableGroup() {
    const obj = canvas.getActiveObject()
    if (!obj) return null
    if (obj.type === "group") return (obj.tableGroup || obj.name === "table") ? obj : null
    if (obj.group && (obj.group.tableGroup || obj.group.name === "table")) return obj.group
    return null
}

function setInfoFormEnabled(enabled) {
    const ids = ["infoName", "infoPhone", "infoGuests", "infoNotes", "infoSaveBtn", "infoClearBtn"]
    ids.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.disabled = !enabled
    })
}

function loadInfoFromGroupToForm(group) {
    const tn = document.getElementById("infoTableNumber")
    const name = document.getElementById("infoName")
    const phone = document.getElementById("infoPhone")
    const guests = document.getElementById("infoGuests")
    const notes = document.getElementById("infoNotes")
    if (!tn || !name || !phone || !guests || !notes) return
    tn.textContent = typeof group.tableNumber === "number" ? String(group.tableNumber) : "—"
    const info = group.info || {}
    name.value = info.name || ""
    phone.value = info.phone || ""
    guests.value = typeof info.guests === "number" ? String(info.guests) : ""
    notes.value = info.notes || ""
}

function saveInfoForSelectedTable() {
    const group = getSelectedTableGroup()
    if (!group) return
    const name = document.getElementById("infoName")?.value || ""
    const phone = document.getElementById("infoPhone")?.value || ""
    const guestsStr = document.getElementById("infoGuests")?.value || ""
    const notes = document.getElementById("infoNotes")?.value || ""
    const guests = guestsStr === "" ? undefined : Math.max(0, parseInt(guestsStr, 10) || 0)
    group.info = { name, phone, guests, notes }
    canvas.requestRenderAll()
}

function clearInfoForSelectedTable() {
    const group = getSelectedTableGroup()
    if (!group) return
    group.info = undefined
    const name = document.getElementById("infoName")
    const phone = document.getElementById("infoPhone")
    const guests = document.getElementById("infoGuests")
    const notes = document.getElementById("infoNotes")
    if (name) name.value = ""
    if (phone) phone.value = ""
    if (guests) guests.value = ""
    if (notes) notes.value = ""
}

function updateInfoFormUI() {
    const group = getSelectedTableGroup()
    const has = !!group
    setInfoFormEnabled(has)
    if (has) {
        loadInfoFromGroupToForm(group)
    } else {
        const tn = document.getElementById("infoTableNumber")
        if (tn) tn.textContent = "—"
    }
}

document.getElementById("infoSaveBtn")?.addEventListener("click", () => saveInfoForSelectedTable())
document.getElementById("infoClearBtn")?.addEventListener("click", () => clearInfoForSelectedTable())

// i18n
let currentLang = (localStorage.getItem("lang") || "ar")
const i18n = {
    ar: {
        grid: "الشبكة",
        zoomIn: "تكبير",
        zoomOut: "تصغير",
        fit: "ملاءمة",
        reset: "إعادة الضبط",
        deleteTable: "حذف طاولة",
        add: "إضافة",
        save: "حفظ",
        load: "تحميل",
        export: "تصدير",
        import: "استيراد",
        image: "صورة",
        theme: "الوضع",
        language: "اللغة",
        info: "معلومات",
        tablesLabel: "الطاولات",
        seatsLabel: "الكراسي",
        reservedTablesLabel: "محجوز طاولات",
        reservedSeatsLabel: "محجوز كراسي",
        drawerTitle: "معلومات الطاولة",
        customerName: "اسم العميل",
        phone: "رقم الهاتف",
        guests: "عدد الضيوف",
        notes: "ملاحظات",
        namePh: "مثال: أحمد علي",
        phonePh: "05xxxxxxxx",
        notesPh: "ملاحظات إضافية",
        hint: "اختر طاولة من القاعة لتحرير معلوماتها.",
        saved: "تم حفظ التصميم",
        reserve: "حجز",
        reserved: "محجوز",
        reserveTitle: "حجز الطاولة",
        unreserveTitle: "إلغاء الحجز",
        infoSave: "حفظ",
        infoClear: "مسح",
        toggleLangTitle: "تبديل اللغة",
        infoTitle: "معلومات الطاولة",
        tableWord: "طاولة",
        zoom: "الزووم",
        tables: "الطاولات",
        file: "الملف",
        addTable: "إضافة طاولة",
        reserveTable: "حجز طاولة",
        tableInfo: "معلومات الطاولة",
        saveDesign: "حفظ التصميم",
        loadDesign: "تحميل التصميم",
        exportJSON: "تصدير JSON",
        importJSON: "استيراد JSON",
        exportImage: "تصدير صورة",
        back: "عودة"
    },
    en: {
        grid: "Grid",
        zoomIn: "Zoom In",
        zoomOut: "Zoom Out",
        fit: "Fit",
        reset: "Reset",
        deleteTable: "Delete Table",
        add: "Add",
        save: "Save",
        load: "Load",
        export: "Export",
        import: "Import",
        image: "Image",
        theme: "Theme",
        language: "Language",
        info: "Info",
        tablesLabel: "Tables",
        seatsLabel: "Seats",
        reservedTablesLabel: "Reserved Tables",
        reservedSeatsLabel: "Reserved Seats",
        drawerTitle: "Table Info",
        customerName: "Customer Name",
        phone: "Phone",
        guests: "Guests",
        notes: "Notes",
        namePh: "e.g., Ahmed Ali",
        phonePh: "05xxxxxxxx",
        notesPh: "Additional notes",
        hint: "Select a table to edit its info.",
        saved: "Design saved",
        reserve: "Reserve",
        reserved: "Reserved",
        reserveTitle: "Reserve table",
        unreserveTitle: "Unreserve",
        infoSave: "Save",
        infoClear: "Clear",
        toggleLangTitle: "Toggle language",
        infoTitle: "Table Info",
        tableWord: "Table",
        zoom: "Zoom",
        tables: "Tables",
        file: "File",
        addTable: "Add Table",
        reserveTable: "Reserve Table",
        tableInfo: "Table Info",
        saveDesign: "Save Design",
        loadDesign: "Load Design",
        exportJSON: "Export JSON",
        importJSON: "Import JSON",
        exportImage: "Export Image",
        back: "Back"
    }
}
function t(key) {
    const L = i18n[currentLang] || i18n.ar
    return L[key] || key
}
function setDirForLang() {
    const rtl = currentLang === "ar"
    document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr")
    document.documentElement.setAttribute("lang", currentLang)
}
function applyI18n() {
    const setBtn = (id, labelKey, titleKey) => {
        const b = document.getElementById(id)
        if (!b) return
        const lb = b.querySelector(".lb")
        if (lb) lb.textContent = t(labelKey)
        if (titleKey) b.title = t(titleKey)
    }

    // Update main buttons
    setBtn("gridBtn", "grid", "grid")
    setBtn("themeBtn", "theme", "theme")
    setBtn("langBtn", "language", "toggleLangTitle")

    // Update navigation buttons
    document.querySelectorAll('.nav-btn .lb').forEach(lb => {
        const text = lb.textContent.trim()
        if (text === "الزووم") lb.textContent = t("zoom")
        else if (text === "الطاولات") lb.textContent = t("tables")
        else if (text === "الملف") lb.textContent = t("file")
    })

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const title = btn.title
        if (title === "الزووم") btn.title = t("zoom")
        else if (title === "الطاولات") btn.title = t("tables")
        else if (title === "الملف") btn.title = t("file")
    })

    // Update back buttons
    document.querySelectorAll('.back-btn .lb').forEach(lb => {
        if (lb.textContent.trim() === "عودة") {
            lb.textContent = t("back")
        }
    })

    document.querySelectorAll('.back-btn').forEach(btn => {
        if (btn.title === "العودة") {
            btn.title = t("back")
        }
    })

    // Update navigation section buttons
    document.querySelectorAll('.nav-section button .lb').forEach(lb => {
        const text = lb.textContent.trim()
        if (text === "تصغير") lb.textContent = t("zoomOut")
        else if (text === "تكبير") lb.textContent = t("zoomIn")
        else if (text === "ملاءمة") lb.textContent = t("fit")
        else if (text === "إعادة الضبط") lb.textContent = t("reset")
        else if (text === "إضافة طاولة") lb.textContent = t("addTable")
        else if (text === "حذف طاولة") lb.textContent = t("deleteTable")
        else if (text === "حجز طاولة") lb.textContent = t("reserveTable")
        else if (text === "معلومات الطاولة") lb.textContent = t("tableInfo")
        else if (text === "حفظ التصميم") lb.textContent = t("saveDesign")
        else if (text === "تحميل التصميم") lb.textContent = t("loadDesign")
        else if (text === "تصدير JSON") lb.textContent = t("exportJSON")
        else if (text === "استيراد JSON") lb.textContent = t("importJSON")
        else if (text === "تصدير صورة") lb.textContent = t("exportImage")
    })

    document.querySelectorAll('.nav-section button').forEach(btn => {
        const title = btn.title
        if (title === "تصغير") btn.title = t("zoomOut")
        else if (title === "تكبير") btn.title = t("zoomIn")
        else if (title === "ملاءمة") btn.title = t("fit")
        else if (title === "إعادة الضبط") btn.title = t("reset")
        else if (title === "إضافة طاولة") btn.title = t("addTable")
        else if (title === "حذف طاولة") btn.title = t("deleteTable")
        else if (title === "حجز الطاولة") btn.title = t("reserveTable")
        else if (title === "معلومات الطاولة") btn.title = t("tableInfo")
        else if (title === "حفظ التصميم") btn.title = t("saveDesign")
        else if (title === "تحميل التصميم") btn.title = t("loadDesign")
        else if (title === "تصدير JSON") btn.title = t("exportJSON")
        else if (title === "استيراد JSON") btn.title = t("importJSON")
        else if (title === "تصدير صورة") btn.title = t("exportImage")
    })
    const tl = document.getElementById("tableLabel"); if (tl) tl.textContent = t("tablesLabel")
    const sl = document.getElementById("seatLabel"); if (sl) sl.textContent = t("seatsLabel")
    const rtlb = document.getElementById("reservedTableLabel"); if (rtlb) rtlb.textContent = t("reservedTablesLabel")
    const rslb = document.getElementById("reservedSeatLabel"); if (rslb) rslb.textContent = t("reservedSeatsLabel")
    const tld = document.getElementById("tableLabelDrawer"); if (tld) tld.textContent = t("tablesLabel")
    const sld = document.getElementById("seatLabelDrawer"); if (sld) sld.textContent = t("seatsLabel")
    const rtld = document.getElementById("reservedTableLabelDrawer"); if (rtld) rtld.textContent = t("reservedTablesLabel")
    const rsld = document.getElementById("reservedSeatLabelDrawer"); if (rsld) rsld.textContent = t("reservedSeatsLabel")
    const dTitle = document.getElementById("drawerTitle"); if (dTitle) dTitle.textContent = t("drawerTitle")
    const lName = document.getElementById("labelName"); if (lName) lName.textContent = t("customerName")
    const lPhone = document.getElementById("labelPhone"); if (lPhone) lPhone.textContent = t("phone")
    const lGuests = document.getElementById("labelGuests"); if (lGuests) lGuests.textContent = t("guests")
    const lNotes = document.getElementById("labelNotes"); if (lNotes) lNotes.textContent = t("notes")
    const inName = document.getElementById("infoName"); if (inName) inName.placeholder = t("namePh")
    const inPhone = document.getElementById("infoPhone"); if (inPhone) inPhone.placeholder = t("phonePh")
    const inNotes = document.getElementById("infoNotes"); if (inNotes) inNotes.placeholder = t("notesPh")
    const sBtn = document.getElementById("infoSaveBtn"); if (sBtn) sBtn.title = t("save")
    const sTxt = document.getElementById("infoSaveText"); if (sTxt) sTxt.textContent = t("infoSave")
    const cBtn = document.getElementById("infoClearBtn"); if (cBtn) cBtn.title = t("infoClear")
    const cTxt = document.getElementById("infoClearText"); if (cTxt) cTxt.textContent = t("infoClear")
    const hint = document.getElementById("infoHint"); if (hint) hint.textContent = t("hint")
    const addItems = document.querySelectorAll("#addMenu .addMenuItem")
    addItems.forEach(btn => {
        const seats = btn.getAttribute("data-seats")
        if (seats) btn.textContent = `${t("tableWord")} ${seats}`
    })
    updateReserveButtonUI()
}
function initLanguage() {
    setDirForLang()
    applyI18n()
}
function toggleLanguage() {
    currentLang = currentLang === "ar" ? "en" : "ar"
    localStorage.setItem("lang", currentLang)
    initLanguage()
}

// تهيئة اللغة بعد تعريف دوال وقاموس i18n
initLanguage()

function exportJSONFile() {
    let json = JSON.stringify(canvas.toJSON(["name", "tableNumber", "reserved", "info"]))
    let blob = new Blob([json], { type: "application/json" })
    let a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "hall.json"
    a.click()
    URL.revokeObjectURL(a.href)
}

function importJSONFile() {
    let input = document.getElementById("jsonFile")
    if (!input) return
    input.value = ""
    input.onchange = () => {
        let file = input.files && input.files[0]
        if (!file) return
        let reader = new FileReader()
        reader.onload = () => {
            let data = reader.result
            canvas.loadFromJSON(
                data,
                function () {
                    fixupLoadedTables()
                    recalcStats()
                    canvas.requestRenderAll()
                },
                function (o, object) {
                    if (object && object.type === "group") {
                        let isTable = !!(object.name === "table" || object.tableGroup)
                        if (!isTable) {
                            const arr = object._objects || object.objects
                            if (arr && Array.isArray(arr)) {
                                const hasRect = arr.some(x => x.type === "rect")
                                const txt = arr.find(x => x.type === "text")
                                if (hasRect && txt) {
                                    object.name = "table"
                                    if (typeof object.tableNumber !== "number") {
                                        const n = parseInt(String(txt.text), 10)
                                        if (!isNaN(n)) object.tableNumber = n
                                    }
                                    isTable = true
                                }
                            }
                        }
                        if (isTable) {
                            makeTableGroup(object)
                        }
                    }
                }
            )
        }
        reader.readAsText(file)
    }
    input.click()
}

function toggleAddMenu() {
    const menu = document.getElementById("addMenu")
    if (!menu) return

    const isOpen = menu.style.display === "block"
    if (isOpen) {
        menu.style.display = "none"
        return
    }

    // Find the add table button in the current active navigation section
    const addTableBtn = document.querySelector('.nav-section.active button[onclick*="toggleAddMenu"]')
    if (addTableBtn) {
        const r = addTableBtn.getBoundingClientRect()
        menu.style.display = "block"
        const mw = menu.offsetWidth || 200
        let left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8))
        menu.style.left = `${left}px`
        menu.style.top = `${r.bottom + 8}px`
    } else {
        // Fallback: show menu in the center if button not found
        menu.style.display = "block"
        menu.style.left = "50%"
        menu.style.top = "100px"
        menu.style.transform = "translateX(-50%)"
    }
}

function showNavSection(sectionId) {
    // Hide all navigation sections
    document.querySelectorAll('.nav-section').forEach(section => {
        section.classList.remove('active')
    })

    // Show the requested section
    const targetSection = document.getElementById(sectionId)
    if (targetSection) {
        targetSection.classList.add('active')
    }
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId)
    if (!dropdown) return

    // Close all other dropdowns
    document.querySelectorAll('.dropdown').forEach(d => {
        if (d.id !== dropdownId && d.classList.contains('open')) {
            d.classList.remove('open')
        }
    })

    // Toggle current dropdown
    dropdown.classList.toggle('open')
}

document.addEventListener("click", (e) => {
    // Close add menu when clicking outside
    const menu = document.getElementById("addMenu")
    if (menu && menu.style.display === "block") {
        // Check if click is outside the menu and outside any add table button
        const isClickOnAddButton = e.target.closest('button[onclick*="toggleAddMenu"]')
        const isClickInsideMenu = menu.contains(e.target)

        if (!isClickOnAddButton && !isClickInsideMenu) {
            menu.style.display = "none"
        }
    }

    // Close dropdowns when clicking outside
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        const dropdownBtn = dropdown.querySelector('button')
        const dropdownMenu = dropdown.querySelector('.menu')
        if (dropdown.classList.contains('open') &&
            !dropdownBtn.contains(e.target) &&
            !dropdownMenu.contains(e.target)) {
            dropdown.classList.remove('open')
        }
    })
})

function initTheme() {
    const saved = localStorage.getItem("theme") || "dark"
    document.body.setAttribute("data-theme", saved)
    const btn = document.getElementById("themeBtn")
    if (btn) btn.querySelector(".ic").textContent = saved === "dark" ? "🌙" : "☀️"
}

function toggleTheme() {
    const cur = document.body.getAttribute("data-theme") || "dark"
    const next = cur === "dark" ? "light" : "dark"
    document.body.setAttribute("data-theme", next)
    localStorage.setItem("theme", next)
    const btn = document.getElementById("themeBtn")
    if (btn) btn.querySelector(".ic").textContent = next === "dark" ? "🌙" : "☀️"
}

function toggleDrawer() {
    const drawer = document.getElementById("drawer")
    const overlay = document.getElementById("drawerOverlay")
    const infoBtn = document.getElementById("infoBtn")
    if (!drawer || !overlay) return
    const open = drawer.classList.toggle("open")
    overlay.classList.toggle("show", open)
    if (infoBtn) {
        infoBtn.classList.toggle("toggled", open)
    }
    updateInfoFormUI()
}

document.getElementById("drawerOverlay")?.addEventListener("click", () => toggleDrawer())
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const drawer = document.getElementById("drawer")
        const overlay = document.getElementById("drawerOverlay")
        if (drawer && overlay && drawer.classList.contains("open")) {
            toggleDrawer()
        }
    }
})

// مزامنة عدادات الإحصائيات في الدرج
const _origUpdateStats = updateStats
updateStats = function () {
    _origUpdateStats()
    const seat = document.getElementById("seatCountDrawer")
    const table = document.getElementById("tableCountDrawer")
    const rTable = document.getElementById("reservedTableCountDrawer")
    const rSeat = document.getElementById("reservedSeatCountDrawer")
    if (seat) seat.innerText = totalSeats
    if (table) table.innerText = totalTables
    if (rTable) rTable.innerText = totalReservedTables
    if (rSeat) rSeat.innerText = totalReservedSeats
}
