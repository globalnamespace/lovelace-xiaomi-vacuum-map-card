/* eslint-disable @typescript-eslint/no-explicit-any */
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent, LovelaceCardEditor } from "custom-card-helpers";

import { RoomConfigEventData, TranslatableString, XiaomiVacuumMapCardConfig } from "./types/types";
import { localizeWithHass } from "./localize/localize";
import { PlatformGenerator } from "./model/generators/platform-generator";
import {
    CARD_VERSION,
    EDITOR_CUSTOM_ELEMENT_NAME,
    EVENT_AUTOGENERATED_CONFIG,
    EVENT_AUTOGENERATED_CONFIG_GET,
    EVENT_ROOM_CONFIG,
    EVENT_ROOM_CONFIG_GET,
    EVENT_SELECTION_CHANGED,
    EVENT_SERVICE_CALL,
    EVENT_SERVICE_CALL_GET,
} from "./const";
import { copyMessage } from "./utils";
import { ToastRenderer } from "./renderers/toast-renderer";
import { HomeAssistantFixed } from "./types/fixes";

@customElement(EDITOR_CUSTOM_ELEMENT_NAME)
export class XiaomiVacuumMapCardEditor extends LitElement implements Omit<LovelaceCardEditor, "hass"> {
    @property({ attribute: false }) public hass?: HomeAssistantFixed;
    @state() private _config?: XiaomiVacuumMapCardConfig;
    @state() private _helpers?: any;
    @state() private _lastSelection?: any;
    private _initialized = false;

    constructor() {
        super();
        this._handleNewSelection = this._handleNewSelection.bind(this);
        this._handleAutogeneratedConfig = this._handleAutogeneratedConfig.bind(this);
        this._handleRoomConfig = this._handleRoomConfig.bind(this);
        this._handleServiceCall = this._handleServiceCall.bind(this);
    }

    get _title(): string {
        return this._config?.title || "";
    }

    get _entity(): string {
        return this._config?.entity || "";
    }

    get _vacuum_platform(): string {
        return this._config?.vacuum_platform || "";
    }

    get _camera(): string {
        return this._config?.map_source?.camera || "";
    }

    get _map_locked(): boolean {
        return this._config?.map_locked || false;
    }

    get _two_finger_pan(): boolean {
        return this._config?.two_finger_pan || false;
    }

    private static _copyServiceCall(): void {
        window.dispatchEvent(new Event(EVENT_SERVICE_CALL_GET));
    }

    private _setStaticConfig(): void {
        if (window.confirm(this._localize("editor.alerts.set_static_config"))) {
            window.dispatchEvent(new Event(EVENT_AUTOGENERATED_CONFIG_GET));
        }
    }

    private static _generateRoomsConfig(): void {
        window.dispatchEvent(new Event(EVENT_ROOM_CONFIG_GET));
    }

    public setConfig(config: XiaomiVacuumMapCardConfig): void {
        this._config = config;
        this.loadCardHelpers();
    }

    connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener(EVENT_SELECTION_CHANGED, this._handleNewSelection);
        window.addEventListener(EVENT_AUTOGENERATED_CONFIG, this._handleAutogeneratedConfig);
        window.addEventListener(EVENT_ROOM_CONFIG, this._handleRoomConfig);
        window.addEventListener(EVENT_SERVICE_CALL, this._handleServiceCall);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener(EVENT_SELECTION_CHANGED, this._handleNewSelection);
        window.removeEventListener(EVENT_AUTOGENERATED_CONFIG, this._handleAutogeneratedConfig);
        window.removeEventListener(EVENT_ROOM_CONFIG, this._handleRoomConfig);
        window.removeEventListener(EVENT_SERVICE_CALL, this._handleServiceCall);
    }

    protected shouldUpdate(): boolean {
        if (!this._initialized) {
            this._initialize();
        }
        return true;
    }

    protected render(): TemplateResult | void {
        if (!this.hass || !this._helpers) {
            return html``;
        }

        this._helpers.importMoreInfoControl("climate");

        const entityIds = Object.keys(this.hass.states);
        const cameras = entityIds.filter(e => e.substr(0, e.indexOf(".")) === "camera");
        const vacuums = entityIds.filter(e => e.substr(0, e.indexOf(".")) === "vacuum");
        const platforms = PlatformGenerator.getPlatforms();
        const roomsUnavailable =
            this.hass.states[this._camera]?.attributes?.["rooms"] === undefined ||
            PlatformGenerator.getRoomsTemplate(this._vacuum_platform) === undefined;

        return html`
            <div class="card-config">
                <div class="description">
                    ${this._localize("editor.description.before_link")}<a
                        target="_blank"
                        href="https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor"
                        >${this._localize("editor.description.link_text")}</a
                    >${this._localize("editor.description.after_link")}
                </div>
                <div class="values">
                    <ha-textfield
                        label="${this._localize("editor.label.name")}"
                        .value="${this._title}"
                        .configValue="${"title"}"
                        @input="${this._titleChanged}"></ha-textfield>
                </div>
                <div class="values">
                    <ha-select
                        naturalMenuWidth
                        fixedMenuPosition
                        label="${this._localize("editor.label.entity")}"
                        @selected="${this._entityChanged}"
                        @closed="${ev => ev.stopPropagation()}"
                        .configValue="${"entity"}"
                        .value="${this._entity}">
                        ${vacuums.map(entity => {
                            return html` <mwc-list-item .value="${entity}">${entity}</mwc-list-item> `;
                        })}
                    </ha-select>
                </div>
                <div class="values">
                    <ha-select
                        naturalMenuWidth
                        fixedMenuPosition
                        label="${this._localize("editor.label.vacuum_platform")}"
                        @selected="${this._entityChanged}"
                        @closed="${ev => ev.stopPropagation()}"
                        .configValue="${"vacuum_platform"}"
                        .value="${this._vacuum_platform}">
                        ${platforms.map(platform => {
                            return html` <mwc-list-item .value="${platform}">${platform}</mwc-list-item> `;
                        })}
                    </ha-select>
                    <p>
                        <a
                            href="${PlatformGenerator.getPlatformsDocumentationUrl(this._vacuum_platform)}"
                            target="_blank">
                            ${this._localize([
                                "editor.label.platforms_documentation",
                                "{0}",
                                this._config?.vacuum_platform ?? PlatformGenerator.XIAOMI_MIIO_PLATFORM,
                            ])}
                        </a>
                    </p>
                </div>
                <div class="values">
                    <ha-select
                        naturalMenuWidth
                        fixedMenuPosition
                        label="${this._localize("editor.label.camera")}"
                        @selected="${this._cameraChanged}"
                        @closed="${ev => ev.stopPropagation()}"
                        .configValue="${"camera"}"
                        .value="${this._camera}">
                        ${cameras.map(entity => {
                            return html` <mwc-list-item .value="${entity}">${entity}</mwc-list-item> `;
                        })}
                    </ha-select>
                </div>
                <div class="values">
                    <ha-formfield class="switch-wrapper" .label="${this._localize("editor.label.map_locked")}">
                        <ha-switch
                            .checked="${this._map_locked}"
                            .configValue="${"map_locked"}"
                            @change="${this._valueChanged}"></ha-switch>
                    </ha-formfield>
                </div>
                <div class="values">
                    <ha-formfield class="switch-wrapper" .label="${this._localize("editor.label.two_finger_pan")}">
                        <ha-switch
                            .checked="${this._two_finger_pan}"
                            .configValue="${"two_finger_pan"}"
                            @change="${this._valueChanged}"></ha-switch>
                    </ha-formfield>
                </div>
                <div class="values separated selection-controls-wrapper">
                    <p>${this._localize("editor.label.selection")}</p>
                    <code class="selection-text">${this._lastSelection ?? "[]"}</code>
                    <mwc-button @click="${() => this._copySelection()}">
                        ${this._localize("editor.label.copy")}
                    </mwc-button>
                </div>
                <div class="values config-buttons-wrapper">
                    <mwc-button @click="${() => this._setStaticConfig()}">
                        ${this._localize("editor.label.set_static_config")}
                    </mwc-button>
                    <mwc-button
                        @click="${() => XiaomiVacuumMapCardEditor._generateRoomsConfig()}"
                        .disabled=${roomsUnavailable}>
                        ${this._localize("editor.label.generate_rooms_config")}
                    </mwc-button>
                    <mwc-button @click="${() => XiaomiVacuumMapCardEditor._copyServiceCall()}">
                        ${this._localize("editor.label.copy_service_call")}
                    </mwc-button>
                </div>
                <div class="version">${this._localize("common.version")} ${CARD_VERSION}</div>
                ${ToastRenderer.render("editor")}
            </div>
        `;
    }

    private _initialize(): void {
        if (this.hass === undefined) return;
        if (this._config === undefined) return;
        if (this._helpers === undefined) return;
        this._initialized = true;
    }

    private async loadCardHelpers(): Promise<void> {
        this._helpers = await (window as any).loadCardHelpers();
    }

    private _handleNewSelection(e: Event): void {
        this._lastSelection = JSON.stringify((e as any).selection).replaceAll(",", ", ");
    }

    private _handleAutogeneratedConfig(e: Event): void {
        const config = (e as any).presetConfig as XiaomiVacuumMapCardConfig;
        this._showToast("editor.label.config_set", "mdi:check", true);
        this._setConfig(config);
    }

    private _handleRoomConfig(e: Event): void {
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(this._vacuum_platform);
        const roomConfig = (e as any).roomConfig as RoomConfigEventData;
        if (!roomConfig) {
            this._showToast("editor.label.config_set_failed", "mdi:close", false);
            return;
        }
        const map_modes = this._config?.map_modes ?? [];
        if (map_modes.length !== 0 && (roomConfig.modeIndex ?? -1) >= 0) {
            map_modes[roomConfig.modeIndex ?? -1] = {
                ...map_modes[roomConfig.modeIndex ?? -1],
                predefined_selections: roomConfig.rooms,
            };
        } else {
            if (map_modes.length === 0) {
                map_modes.push(...PlatformGenerator.generateDefaultModes(this._vacuum_platform));
            }
            if (roomsTemplate) {
                map_modes.push({
                    template: roomsTemplate,
                    predefined_selections: roomConfig.rooms,
                });
            }
        }
        if (this._config) {
            this._setConfig({ ...this._config, map_modes: map_modes });
        }
        this._showToast("editor.label.config_set", "mdi:check", true);
    }

    private _handleServiceCall(e: Event): void {
        const serviceCall = (e as any).serviceCall as string;
        copyMessage(serviceCall ?? "");
        this._showToast("editor.label.copied", "mdi:content-copy", true);
    }

    private _copySelection(): void {
        copyMessage(this._lastSelection ?? []);
        this._showToast("editor.label.copied", "mdi:content-copy", true);
    }

    private _showToast(text: string, icon: string, successful: boolean, additionalText = ""): void {
        ToastRenderer.showToast(
            this.shadowRoot,
            v => this._localize(v),
            "editor",
            text,
            icon,
            successful,
            additionalText,
        );
    }

    private _entityChanged(ev): void {
        this._valueChanged(ev);
    }

    private _cameraChanged(ev): void {
        if (!this._config || !this.hass) {
            return;
        }
        const value = ev.target.value;
        if (this._camera === value) return;
        const tmpConfig = { ...this._config };
        tmpConfig["map_source"] = { camera: value };
        tmpConfig["calibration_source"] = { camera: true };
        this._config = tmpConfig;
        fireEvent(this, "config-changed", { config: this._config });
    }

    private _titleChanged(ev): void {
        this._valueChanged(ev);
    }

    private _valueChanged(ev): void {
        if (!this._config || !this.hass) {
            return;
        }
        const target = ev.target;
        if (this[`_${target.configValue}`] === target.value) {
            return;
        }
        if (!target.configValue) {
            const tmpConfig = { ...this._config };
            delete tmpConfig[target.configValue];
            this._config = tmpConfig;
        } else {
            this._config = {
                ...this._config,
                [target.configValue]: target.checked !== undefined ? target.checked : target.value,
            };
        }
        fireEvent(this, "config-changed", { config: this._config });
    }

    private _setConfig(config: XiaomiVacuumMapCardConfig): void {
        this._config = { ...config };
        fireEvent(this, "config-changed", { config: this._config });
    }

    private _localize(ts: TranslatableString): string {
        return localizeWithHass(ts, this.hass);
    }

    static get styles(): CSSResultGroup {
        return css`
            .card-config {
                position: relative;
                --map-card-internal-toast-successful-icon-color: var(
                    --map-card-toast-successful-icon-color,
                    rgb(0, 255, 0)
                );
                --map-card-internal-toast-unsuccessful-icon-color: var(
                    --map-card-toast-unsuccessful-icon-color,
                    rgb(255, 0, 0)
                );
                --map-card-internal-small-radius: var(--map-card-small-radius, 18px);
                --map-card-internal-primary-color: var(--map-card-primary-color, var(--slider-color));
                padding-bottom: 15px;
            }

            .values {
                padding-left: 16px;
                margin: 8px;
                display: grid;
            }

            .switch-wrapper {
                padding: 8px;
            }

            .selection-controls-wrapper {
                display: flex;
                align-content: stretch;
                justify-content: space-between;
                align-items: center;
            }

            .config-buttons-wrapper {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 20px;
            }

            .selection-text {
                flex-grow: 1;
                padding: 10px;
            }

            .separated {
                border-top: solid 1px;
                border-top-color: var(--primary-text-color);
            }
          
            .version {
                position: absolute;
                bottom: 0;
                right: 0;
                opacity: 30%;
            }

            ${ToastRenderer.styles}
        `;
    }
}
