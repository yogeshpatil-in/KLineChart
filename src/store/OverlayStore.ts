/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Nullable from '../common/Nullable'
import { UpdateLevel } from '../common/Updater'
import { MouseTouchEvent } from '../common/SyntheticEvent'

import { createId } from '../common/utils/id'

import OverlayImp, { OVERLAY_ID_PREFIX, OVERLAY_ACTIVE_Z_LEVEL, OverlayCreate, OverlayRemove } from '../component/Overlay'

import { getOverlayClass } from '../extension/overlay/index'

import ChartStore from './ChartStore'

import { PaneIdConstants } from '../pane/Pane'
import { isFunction } from '../common/utils/typeChecks'

export interface ProgressOverlayInfo {
  paneId: string
  instance: OverlayImp
  appointPaneFlag: boolean
}

export const enum EventOverlayInfoFigureType {
  None, Point, Other
}

export interface EventOverlayInfo {
  paneId: string
  instance: Nullable<OverlayImp>
  figureType: EventOverlayInfoFigureType
  figureKey: string
  figureIndex: number
  attrsIndex: number
}

export default class OverlayStore {
  private readonly _chartStore: ChartStore

  private _instances = new Map<string, OverlayImp[]>()

  private readonly _counter = new Map<string, number>()

  /**
   * Overlay information in painting
   */
  private _progressInstanceInfo: Nullable<ProgressOverlayInfo> = null

  /**
   * Overlay information by the mouse pressed
   */
  private _pressedInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  /**
   * Overlay information by hover
   */
  private _hoverInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  /**
   * Overlay information by the mouse click
   */
  private _clickInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  constructor (chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  private _overrideInstance (instance: OverlayImp, overlay: Partial<OverlayCreate>): [boolean, boolean] {
    const {
      id, groupId, points, styles, lock, visible,
      zLevel, mode, modeSensitivity, extendData,
      onDrawStart, onDrawing,
      onDrawEnd, onClick, onDoubleClick, onRightClick,
      onPressedMoveStart, onPressedMoving, onPressedMoveEnd,
      onMouseEnter, onMouseLeave,
      onRemoved, onSelected, onDeselected
    } = overlay
    let updateFlag = false
    let sortFlag = false
    if (id !== undefined) {
      instance.setId(id)
    }
    if (groupId !== undefined) {
      instance.setGroupId(groupId)
    }
    if (points !== undefined && instance.setPoints(points)) {
      updateFlag = true
    }
    if (styles !== undefined && instance.setStyles(styles)) {
      updateFlag = true
    }
    if (lock !== undefined) {
      instance.setLock(lock)
    }
    if (visible !== undefined && instance.setVisible(visible)) {
      updateFlag = true
    }
    if (zLevel !== undefined && instance.setZLevel(zLevel)) {
      updateFlag = true
      sortFlag = true
    }
    if (mode !== undefined) {
      instance.setMode(mode)
    }
    if (modeSensitivity !== undefined) {
      instance.setModeSensitivity(modeSensitivity)
    }
    if (extendData !== undefined && instance.setExtendData(extendData)) {
      updateFlag = true
    }
    if (onDrawStart !== undefined) {
      instance.setOnDrawStartCallback(onDrawStart)
    }
    if (onDrawing !== undefined) {
      instance.setOnDrawingCallback(onDrawing)
    }
    if (onDrawEnd !== undefined) {
      instance.setOnDrawEndCallback(onDrawEnd)
    }
    if (onClick !== undefined) {
      instance.setOnClickCallback(onClick)
    }
    if (onDoubleClick !== undefined) {
      instance.setOnDoubleClickCallback(onDoubleClick)
    }
    if (onRightClick !== undefined) {
      instance.setOnRightClickCallback(onRightClick)
    }
    if (onPressedMoveStart !== undefined) {
      instance.setOnPressedMoveStartCallback(onPressedMoveStart)
    }
    if (onPressedMoving !== undefined) {
      instance.setOnPressedMovingCallback(onPressedMoving)
    }
    if (onPressedMoveEnd !== undefined) {
      instance.setOnPressedMoveEndCallback(onPressedMoveEnd)
    }
    if (onMouseEnter !== undefined) {
      instance.setOnMouseEnterCallback(onMouseEnter)
    }
    if (onMouseLeave !== undefined) {
      instance.setOnMouseLeaveCallback(onMouseLeave)
    }
    if (onRemoved !== undefined) {
      instance.setOnRemovedCallback(onRemoved)
    }
    if (onSelected !== undefined) {
      instance.setOnSelectedCallback(onSelected)
    }
    if (onDeselected !== undefined) {
      instance.setOnDeselectedCallback(onDeselected)
    }
    return [updateFlag, sortFlag]
  }

  getInstanceById (id: string): Nullable<OverlayImp> {
    for (const entry of this._instances) {
      const paneShapes = entry[1]
      const shape = paneShapes.find(s => s.id === id)
      if (shape !== undefined) {
        return shape
      }
    }
    if (this._progressInstanceInfo !== null) {
      if (this._progressInstanceInfo.instance.id === id) {
        return this._progressInstanceInfo.instance
      }
    }
    return null
  }

  private _sort (paneId?: string): void {
    if (paneId !== undefined) {
      this._instances.get(paneId)?.sort((o1, o2) => o1.defaultZLevel - o2.defaultZLevel).sort((o1, o2) => o1.zLevel - o2.zLevel)
    } else {
      this._instances.forEach(paneInstances => {
        paneInstances.sort((o1, o2) => o1.defaultZLevel - o2.defaultZLevel).sort((o1, o2) => o1.zLevel - o2.zLevel)
      })
    }
  }

  addInstances (overlays: OverlayCreate[], paneId: string, appointPaneFlag: boolean): Array<Nullable<string>> {
    const ids = overlays.map(overlay => {
      const id = overlay.id ?? createId(OVERLAY_ID_PREFIX)
      if (this.getInstanceById(id) === null) {
        const OverlayClazz = getOverlayClass(overlay.name)
        if (OverlayClazz !== null) {
          const instance = new OverlayClazz()
          const count = (this._counter.get(paneId) ?? 0) + 1
          this._counter.set(paneId, count)
          instance.setDefaultZLevel(count)
          instance.setPaneId(paneId)
          const groupId = overlay.groupId ?? id
          overlay.id = id
          overlay.groupId = groupId
          this._overrideInstance(instance, overlay)
          if (instance.isDrawing()) {
            this._progressInstanceInfo = { paneId, instance, appointPaneFlag }
          } else {
            if (!this._instances.has(paneId)) {
              this._instances.set(paneId, [])
            }
            this._instances.get(paneId)?.push(instance)
          }
          if (instance.isStart()) {
            instance.onDrawStart?.(({ overlay: instance }))
          }
          return id
        }
      }
      return null
    })
    if (ids.some(id => id !== null)) {
      this._sort()
      this._chartStore.getChart().updatePane(UpdateLevel.Overlay, paneId)
    }
    return ids
  }

  getProgressInstanceInfo (): Nullable<ProgressOverlayInfo> {
    return this._progressInstanceInfo
  }

  progressInstanceComplete (): void {
    if (this._progressInstanceInfo !== null) {
      const { instance, paneId } = this._progressInstanceInfo
      if (!instance.isDrawing()) {
        if (!this._instances.has(paneId)) {
          this._instances.set(paneId, [])
        }
        this._instances.get(paneId)?.push(instance)
        this._sort(paneId)
        this._progressInstanceInfo = null
      }
    }
  }

  updateProgressInstanceInfo (paneId: string, appointPaneFlag?: boolean): void {
    if (this._progressInstanceInfo !== null) {
      if (appointPaneFlag !== undefined && appointPaneFlag) {
        this._progressInstanceInfo.appointPaneFlag = appointPaneFlag
      }
      this._progressInstanceInfo.paneId = paneId
      this._progressInstanceInfo.instance.setPaneId(paneId)
    }
  }

  getInstances (paneId?: string): OverlayImp[] {
    if (paneId === undefined) {
      let instances: OverlayImp[] = []
      this._instances.forEach(paneInstances => {
        instances = instances.concat(paneInstances)
      })
      return instances
    }
    return this._instances.get(paneId) ?? []
  }

  override (overlay: Partial<OverlayCreate>): void {
    const { id, groupId, name } = overlay
    let updateFlag = false
    let sortFlag = false

    const setFlag: (instance: OverlayImp) => void = (instance: OverlayImp) => {
      const flags = this._overrideInstance(instance, overlay)
      if (flags[0]) {
        updateFlag = true
      }
      if (flags[1]) {
        sortFlag = true
      }
    }

    if (id !== undefined) {
      const instance = this.getInstanceById(id)
      if (instance !== null) {
        setFlag(instance)
      }
    } else {
      this._instances.forEach(paneInstances => {
        paneInstances.forEach(instance => {
          if (
            (name !== undefined && instance.name === name) ||
            (groupId !== undefined && instance.groupId === groupId) ||
            (name === undefined && groupId === undefined)
          ) {
            setFlag(instance)
          }
        })
      })
      if (this._progressInstanceInfo !== null) {
        const progressInstance = this._progressInstanceInfo.instance
        if (
          (name !== undefined && progressInstance.name === name) ||
          (groupId !== undefined && progressInstance.groupId === groupId) ||
          (name === undefined && groupId === undefined)
        ) {
          setFlag(progressInstance)
        }
      }
    }
    if (sortFlag) {
      this._sort()
    }
    if (updateFlag) {
      this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
    }
  }

  removeInstance (overlayRemove?: OverlayRemove): void {
    const match: ((remove: OverlayRemove, overlay: OverlayImp) => boolean) = (remove: OverlayRemove, overlay: OverlayImp) => {
      if (remove.id !== undefined) {
        if (overlay.id !== remove.id) {
          return false
        }
      } else {
        if (remove.groupId !== undefined) {
          if (overlay.groupId !== remove.groupId) {
            return false
          }
        } else {
          if (remove.name !== undefined) {
            if (overlay.name !== remove.name) {
              return false
            }
          }
        }
      }
      return true
    }

    const updatePaneIds: string[] = []
    if (this._progressInstanceInfo !== null) {
      const { instance } = this._progressInstanceInfo
      if (
        overlayRemove === undefined ||
        (overlayRemove !== undefined && match(overlayRemove, instance))
      ) {
        updatePaneIds.push(this._progressInstanceInfo.paneId)
        instance.onRemoved?.({ overlay: instance })
        this._progressInstanceInfo = null
      }
    }
    if (overlayRemove !== undefined) {
      const instances = new Map<string, OverlayImp[]>()
      for (const entry of this._instances) {
        const paneInstances = entry[1]
        const newPaneInstances = paneInstances.filter(instance => {
          if (match(overlayRemove, instance)) {
            if (!updatePaneIds.includes(entry[0])) {
              updatePaneIds.push(entry[0])
            }
            instance.onRemoved?.({ overlay: instance })
            return false
          }
          return true
        })
        if (newPaneInstances.length > 0) {
          instances.set(entry[0], newPaneInstances)
        }
      }
      this._instances = instances
    } else {
      this._instances.forEach((paneInstances, paneId) => {
        updatePaneIds.push(paneId)
        paneInstances.forEach(instance => {
          instance.onRemoved?.({ overlay: instance })
        })
      })
      this._instances.clear()
    }
    if (updatePaneIds.length > 0) {
      const chart = this._chartStore.getChart()
      updatePaneIds.forEach(paneId => {
        chart.updatePane(UpdateLevel.Overlay, paneId)
      })
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.XAXIS)
    }
  }

  setPressedInstanceInfo (info: EventOverlayInfo): void {
    this._pressedInstanceInfo = info
  }

  getPressedInstanceInfo (): EventOverlayInfo {
    return this._pressedInstanceInfo
  }

  setHoverInstanceInfo (info: EventOverlayInfo, event: MouseTouchEvent): void {
    const { instance, figureType, figureKey, figureIndex } = this._hoverInstanceInfo
    if (
      instance?.id !== info.instance?.id ||
      figureType !== info.figureType ||
      figureIndex !== info.figureIndex
    ) {
      this._hoverInstanceInfo = info
      if (instance?.id !== info.instance?.id) {
        let ignoreUpdateFlag = false
        let sortFlag = false
        if (instance !== null) {
          sortFlag = true
          instance.resetZLevel()
          if (isFunction(instance.onMouseLeave)) {
            instance.onMouseLeave({ overlay: instance, figureKey, figureIndex, ...event })
            ignoreUpdateFlag = true
          }
        }

        if (info.instance !== null) {
          sortFlag = true
          info.instance.setZLevel(OVERLAY_ACTIVE_Z_LEVEL)
          if (isFunction(info.instance.onMouseEnter)) {
            info.instance.onMouseEnter({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
            ignoreUpdateFlag = true
          }
        }
        if (sortFlag) {
          this._sort()
        }
        if (!ignoreUpdateFlag) {
          this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
        }
      }
    }
  }

  getHoverInstanceInfo (): EventOverlayInfo {
    return this._hoverInstanceInfo
  }

  setClickInstanceInfo (info: EventOverlayInfo, event: MouseTouchEvent): void {
    const { paneId, instance, figureType, figureKey, figureIndex } = this._clickInstanceInfo
    if (!(info.instance?.isDrawing() ?? false)) {
      info.instance?.onClick?.({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
    }
    if (instance?.id !== info.instance?.id || figureType !== info.figureType || figureIndex !== info.figureIndex) {
      this._clickInstanceInfo = info
      if (instance?.id !== info.instance?.id) {
        instance?.onDeselected?.({ overlay: instance, figureKey, figureIndex, ...event })
        info.instance?.onSelected?.({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
        const chart = this._chartStore.getChart()
        chart.updatePane(UpdateLevel.Overlay, info.paneId)
        if (paneId !== info.paneId) {
          chart.updatePane(UpdateLevel.Overlay, paneId)
        }
        chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.XAXIS)
      }
    }
  }

  getClickInstanceInfo (): EventOverlayInfo {
    return this._clickInstanceInfo
  }

  isEmpty (): boolean {
    return this._instances.size === 0 && this._progressInstanceInfo === null
  }

  isDrawing (): boolean {
    return this._progressInstanceInfo !== null && (this._progressInstanceInfo?.instance.isDrawing() ?? false)
  }
}
