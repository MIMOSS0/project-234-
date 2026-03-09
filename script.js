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

function addTable(lengthCM, seats) {

    let widthCM = 80

    let tableWidth = (lengthCM / 100) * meter
    let tableHeight = (widthCM / 100) * meter
    let dd = document.getElementById("addDropdown")
    if (dd) dd.classList.remove("open")

    let table = new fabric.Rect({

        width: tableWidth,
        height: tableHeight,

        fill: "#fff",
        stroke: "#000",

        originX: "center",
        originY: "center"

    })

    let number = new fabric.Text(String(tableNumber), {

        fontSize: 16,
        originX: "center",
        originY: "center"

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
    makeTableGroup(group)

    canvas.add(group)

    tableNumber++

    totalSeats += seats
    totalTables++

    updateStats()

}

//--------------------------------
// الإحصائيات
//--------------------------------

function updateStats() {

    document.getElementById("seatCount").innerText = totalSeats
    document.getElementById("tableCount").innerText = totalTables

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

    let json = JSON.stringify(canvas.toJSON())

    localStorage.setItem("hallDesign", json)

    alert("تم حفظ التصميم")

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
            if (object && (object.name === "table" || object.tableGroup)) {
                makeTableGroup(object)
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
    updateStats()
    fitToScreen()
}

document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        if (!spacePressed) {
            spacePressed = true
            canvas.wrapperEl.classList.add("grab")
        }
        e.preventDefault()
    }
})

document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
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
        if (hasOverlap(group)) {
            group.left = group._lastGood.left
            group.top = group._lastGood.top
            group.angle = group._lastGood.angle
            group.setCoords()
        } else {
            group._lastGood = { left: group.left, top: group.top, angle: group.angle }
        }
    })
    group.on("rotating", function () {
        let snapped = Math.round(group.angle / ROTATE_STEP) * ROTATE_STEP
        group.rotate(snapped)
        clampObjectInsideHall(group)
        group.setCoords()
        if (hasOverlap(group)) {
            group.left = group._lastGood.left
            group.top = group._lastGood.top
            group.angle = group._lastGood.angle
            group.setCoords()
        } else {
            group._lastGood = { left: group.left, top: group.top, angle: group.angle }
        }
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
    canvas.getObjects().forEach(o => {
        if (o.tableGroup || o.name === "table") {
            tables++
            let n = 0
            if (o._objects && Array.isArray(o._objects)) n = o._objects.length
            else if (o.objects && Array.isArray(o.objects)) n = o.objects.length
            else if (typeof o.size === "function") n = o.size()
            let chairs = Math.max(0, n - 2)
            seats += chairs
        }
    })
    totalTables = tables
    totalSeats = seats
    updateStats()
}

function exportJSONFile() {
    let json = JSON.stringify(canvas.toJSON())
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
                    if (object && (object.name === "table" || object.tableGroup)) {
                        makeTableGroup(object)
                    }
                }
            )
        }
        reader.readAsText(file)
    }
    input.click()
}

function toggleAddMenu() {
    const btn = document.getElementById("addBtn")
    const menu = document.getElementById("addMenu")
    if (!btn || !menu) return
    const isOpen = menu.style.display === "block"
    if (isOpen) {
        menu.style.display = "none"
        return
    }
    const r = btn.getBoundingClientRect()
    menu.style.display = "block"
    const mw = menu.offsetWidth || 200
    let left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8))
    menu.style.left = `${left}px`
    menu.style.top = `${r.bottom + 8}px`
}

document.addEventListener("click", (e) => {
    const btn = document.getElementById("addBtn")
    const menu = document.getElementById("addMenu")
    if (!btn || !menu) return
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none"
    }
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
    if (!drawer || !overlay) return
    const open = drawer.classList.toggle("open")
    overlay.classList.toggle("show", open)
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
    if (seat) seat.innerText = totalSeats
    if (table) table.innerText = totalTables
}
