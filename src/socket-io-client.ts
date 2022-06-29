import EventEmitter from 'eventemitter3'
import {io, Socket} from 'socket.io-client'
import { Protocol, Dsgp } from '../protocol/protocol';

const LOG_TAG = 'DarkSun|ServerWorld|SocketIOClient';

interface IOptions  {
    url: string;
    reconnecting?: {
        enabled?: boolean;
        timeout?: number;
    };
}



class SocketIoClient {
    private _eventEmitter: EventEmitter;
    private _url: string = this.options.url;
    private _socket: Socket | null = null;
    private _ran = false;
    private _closeCallback: ((error: unknown | null) => void) | null = null;
    private _reconnecting;
    private _requests = new Map();

    constructor(private options: IOptions) {
        this._url = options.url;
        this._eventEmitter = new EventEmitter();

        this._reconnecting = {
            enabled: options.reconnecting?.enabled || true,
            timeout: options.reconnecting?.timeout || 3000,
        }

        this.onSocketIoMessage = this.onSocketIoMessage.bind(this);
        this.onSocketIoDisconnect = this.onSocketIoDisconnect.bind(this);
    }

    async run(): Promise<void> {
        this._ran = true;
        try {
            await this.connect();
        } catch (e) {
            this._ran = false;
        }
    }

    async shutdown(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._ran && this._socket) {
                reject(`Connection to [${this._url}] already in closing state`);
            };

            this._ran = false;
            if (this._socket) {
                this._closeCallback = (error: unknown | null) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            }
                this._socket.disconnect()
            } else {
                resolve();
            }
        });
    }

    isRan(): boolean {
        return this._ran;
    }

    isConnected(): boolean {
        return this._ran && !!this._socket;
    }


    sendHandshake(request: Protocol.Client.HandshakeRequest): Promise<Protocol.Client.HandshakeResponse> {
        return new Promise((resolve, reject) => {
            if (this._ran && this._socket) {
                const message = Protocol.Client.createHandshakeRequest(request);
                this._requests.set(message.uuid, (error: any, payload: any) => {
                    if (error && error instanceof Error) {
                        reject(error);
                    } else {
                        resolve({
                            error: error,
                            payload: payload,
                        });
                    }
                });
                this.sendMessage(message);
            } else {
                reject(new Error('No connection established'));
            }
        });

    }

    sendMessage(message: Protocol.Client.Message): void {
     

        if (!this._socket) {
            throw new Error('Socket instance was not defined to send a message');
        }
        this._socket.emit("message", message);
        if (message.type !== Protocol.Client.Message.Type.Ping ) {
            log.trace(LOG_TAG, `Send [${JSON.stringify(message)}]`);
        }
    }

    on(event: 'Connected', listener: () => void): SocketIoClient;
    on(event: 'Disconnected', listener: () => void): SocketIoClient;
    on(event: 'Ping', listener: (ping: number) => void): SocketIoClient;
    on(event: 'Event', listener: (event: any) => void): SocketIoClient;
    on(event: string, listener: (...args: any[]) => void): SocketIoClient {
        this._eventEmitter.on(event, listener);
        return this;
    };

    off(event: 'Connected', listener: () => void): SocketIoClient;
    off(event: 'Disconnected', listener: () => void): SocketIoClient;
    off(event: 'Ping', listener: (ping: number) => void): SocketIoClient;
    off(event: 'Event', listener: (event: any) => void): SocketIoClient;
    off(event: string, listener: (...args: any[]) => void): SocketIoClient {
        this._eventEmitter.off(event, listener);
        return this;
    }

    private resetAllRequests(): void {
        this._requests.forEach((callback, key) => {
            callback(new Error('Connection lost'));
        });
        this._requests.clear();
    }

    private handleResponseMessage(message: Protocol.Server.Message): void {
        if (this._requests.has(message.body.requestUuid)) {
            let callback = this._requests.get(message.body.requestUuid);
            this._requests.delete(message.body.requestUuid);
            callback(message.body.error, message.body.payload);
        } else {
            log.error(LOG_TAG, `Request not found for response [` + JSON.stringify(message) + `]`);
        }
    }

    private handleEventMessage(message: Protocol.Server.Message): void {
        this._eventEmitter.emit('Event', message.body);
    }

    private handlePongMessage(message: Protocol.Server.Message): void {
        const timestamp = Date.now();
        log.info(LOG_TAG + '|handlePongMessage', JSON.stringify(message))
    }

    private onSocketIoError(): void {
        log.error(LOG_TAG, `Connection error`);
    }


    private onSocketIoDisconnect(): void {
        log.info(LOG_TAG, `Connection [${this._url}] closed`);
        this._socket = null;
        this.resetAllRequests();

        this._eventEmitter.emit('Disconnected');

        if (this._closeCallback) {
            let closeCallback: (error: unknown | null) => void = this._closeCallback;
            this._closeCallback = null;
            closeCallback(null);
        }

    }

    private onSocketIoMessage(message: Protocol.Server.Message): void {
        try {
            Protocol.Client.validateMessage(message);
        } catch (error) {
            log.error(LOG_TAG, `Validation message error [${error}] message [${JSON.stringify(message)}]`);
            return;
        }

        if (message.type !== Protocol.Client.Message.Type.Pong) {
            log.trace(LOG_TAG, `Receive [${JSON.stringify(message)}]`);
        }
        try {
            Protocol.Client.validateBodyMessage(Dsgp.Message.Type.Response, message.body);
            switch(message.type) {
                case 'Response':
                    this.handleResponseMessage(message);
                    break;
                case 'Event':
                    this.handleEventMessage(message);
                    break;
                case 'Pong':
                    this.handlePongMessage(message);
                    break;
                default:
                    log.error(LOG_TAG, `Unknown message type [${message.type}] uuid [${message.uuid}]`);
                    break;
            }
        } catch (error) {
            log.error(LOG_TAG, `Message body validating error [${error}]`);
            return;
        }
    }

    private establishConnection(): Promise<Socket> {
        log.info(LOG_TAG, `...connecting to [${this._url}]`);

        const socket = io(this._url, {
            reconnection: this._reconnecting.enabled,
            reconnectionDelay: this._reconnecting.timeout,
            
        })

        return new Promise((resolve, reject) => {
            socket.on("connect", () => {
                log.info(LOG_TAG, `Connection to [${this._url}] established`);
                resolve(socket);
            });
            
            socket.on("connect_error", (error) => {
                log.warn(LOG_TAG, `Connection to [${this._url}] failed  error [${error}]`);
                const socketError = new Error(`Connection to [${this._url}] failed`);
                reject(socketError)
            });
        });
    };

    private async connect(): Promise<void> {
        try {
            const socket = await this.establishConnection();
            this._socket = socket;
            this._socket.on("disconnect", this.onSocketIoDisconnect)
            this._socket.on("message", this.onSocketIoMessage)
            this._socket.on("error", this.onSocketIoError)

            this._eventEmitter.emit('Connected');
        } catch(e) {
            throw e;
        }
    };

};


export { SocketIoClient };
