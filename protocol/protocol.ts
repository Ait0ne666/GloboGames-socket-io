import '@darksun/logger'



import Ajv from 'ajv';
import Schema from './schema.json';

const LOG_TAG = 'DarkSun|ServerWorld|Protocol';

let g_ajv: Ajv = new Ajv();

const FlakeIdGenerator = require('flake-idgen');
const FlakeId = new FlakeIdGenerator();
const intformat = require('biguint-format');

namespace Dsgp {
    export type Version = {
        major: number;
        minor: number;
    };

    export type Request<Type> = {
        type: Type;
        payload: Record<string, any>;
    }

    export type Response<Type> = {
        type: Type;
        requestUuid: string;
        error: Error | null,
        payload: Record<string, any> | null;
    }

    export type Event<Type> = {
        type: Type;
        payload: Record<string, any>;
    }

    export type Ping = {
    }

    export type Pong = {
        pingUuid: string;
    }

    export namespace Message {
        export enum Type {
            Request = 'Request',
            Response = 'Response',
            Event = 'Event',
            Ping = 'Ping',
            Pong = 'Pong',
        };
    };

    export type Message = {
        version: Dsgp.Version;
        type: Message.Type;
        uuid: string;
        body: Record<string, any>;
    }

    export type MessageTypeMap<RequestType, EventType> = {
        [Message.Type.Request]: Dsgp.Request<RequestType>;
        [Message.Type.Response]: Response<RequestType>;
        [Message.Type.Event]: Event<EventType>;
        [Message.Type.Ping]: Ping;
        [Message.Type.Pong]: Pong;
    }

}

namespace Protocol {
    export const VERSION: Dsgp.Version = {
        major: 1,
        minor: 0,
    }

    export namespace Data {
        export enum FightArenaSlotType {
            Allie = 'Allie',
            Enemy = 'Enemy'
        };
        export namespace FightArenaSlotCoord {
        }
        export type FightArenaSlotCoord = {
            type: Protocol.Data.FightArenaSlotType,
            index: number,
        }
        export namespace SomeType {
            export enum State {
                One = 'One',
                Two = 'Two'
            };
            export namespace NestedType {
            }
            export type NestedType = {
                test: boolean,
            }
        }
        export type SomeType = {
            var: string,
        }
    }

    export namespace Error {
        export enum Code {
            WrongProtocolVersion = 'WrongProtocolVersion',
            InternalError = 'InternalError',
            BadRequest = 'BadRequest',
        };
    }

    export type Error = {
        code: Error.Code;
        message: string;
    };

    export function createError(code: Protocol.Error.Code, message: unknown): Protocol.Error {
        return {
            code: code,
            message: Util._convertErrorToMessage(message),
        };
    }

    export function parseMessage(message: any) {
        try {
            return JSON.parse(message);
        } catch (e) {
            throw e;
        }
    }

    export namespace Server {
        export namespace Request {
            export enum Type {
                StartFight = 'StartFight',
            }
        }
    
        export type StartFightRequest = {
            data: string,
        }
    
        export type StartFightResponse = {
        }
    
    
        type TypeMapRequest = {
            'StartFight': StartFightRequest;
        }
    
        type ResponseTypeMap = {
            'StartFight': StartFightResponse;
        }
    
        export namespace Event {
            export enum Type {
                FightEnd = 'FightEnd',
            }
        }
    
        export type FightEndEvent = {
            fightId: string,
        }
    
    
        type TypeMapEvent = {
            'FightEnd': FightEndEvent;
        }
    
        export namespace Message {
            export import Type = Dsgp.Message.Type;
        };
    
        export type Message = Dsgp.Message;
        type MessageTypeMap = Dsgp.MessageTypeMap<Request.Type, Event.Type>;
    
        export function createRequest(type: Protocol.Server.Request.Type, payload: Record<string, any>): Protocol.Server.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Server.Message.Type.Request,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    payload: payload
                }
            };
        }
    
        export function createResponse(type: Protocol.Server.Request.Type, requestUuid: string, error: Protocol.Error): Protocol.Server.Message;
        export function createResponse(type: Protocol.Server.Request.Type, requestUuid: string, error: null, payload: Record<string, any>): Protocol.Server.Message;
        export function createResponse(type: Protocol.Server.Request.Type, requestUuid: string, error: Protocol.Error | null, payload?: Record<string, any>): Protocol.Server.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Server.Message.Type.Response,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    requestUuid: requestUuid,
                    error: error,
                    payload: (error === null) ? payload : null,
                }
            };
        }
    
        export function createEvent(type: Protocol.Server.Event.Type, payload: Record<string, any>): Protocol.Server.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Server.Message.Type.Event,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    payload: payload
                }
            };
        }
    
        export function createPing(): Protocol.Server.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Server.Message.Type.Ping,
                uuid: Util._generateGUID(),
                body: {},
            };
        }
    
        export function createPong(pingUuid: string): Protocol.Server.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Server.Message.Type.Pong,
                uuid: Util._generateGUID(),
                body: {
                    pingUuid: pingUuid,
                },
            };
        }
    
        export function createStartFightRequest(request: Protocol.Server.StartFightRequest) {
            return Protocol.Server.createRequest(Protocol.Server.Request.Type.StartFight, {
                data: request.data,
            });
        }
    
        export function createFightEndEvent(event: Protocol.Server.FightEndEvent) {
            return Protocol.Server.createEvent(Protocol.Server.Event.Type.FightEnd, {
                fightId: event.fightId,
            });
        }
    
    
        export function validateMessage(message: Record<string, any>): Protocol.Server.Message {
            let validate = g_ajv.compile<Protocol.Server.Message>(Schema);
            if (validate(message)) {
                return message;
            } else {
                const error = Util._createNativeError(`Message validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(message)}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validateBodyMessage<K extends keyof MessageTypeMap>(messageType: K, messageBody: Record<string, any>): MessageTypeMap[K] {
            let validate = g_ajv.getSchema<MessageTypeMap[K]>(`Server${messageType}`);
            if (validate) {
                if (validate(messageBody)) {
                    return messageBody;
                } else {
                    const error = Util._createNativeError(`Message [${messageType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(messageBody)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [Server${messageType}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadRequest<K extends keyof TypeMapRequest>(requestType: K, requestPayload: Record<string, any>): TypeMapRequest[K] {
            let validate = g_ajv.getSchema<TypeMapRequest[K]>(`Server.Request.${requestType}`);
            if (validate) {
                if (validate(requestPayload)) {
                    return requestPayload;
                } else {
                    const error = Util._createNativeError(`Server.Request [${requestType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(requestPayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Server.Request.${requestType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadResponse<K extends keyof ResponseTypeMap>(responseType: K, responsePayload: Record<string, any>): ResponseTypeMap[K] {
            let validate = g_ajv.getSchema<ResponseTypeMap[K]>(`Server.Response.${responseType}`);
            if (validate) {
                if (validate(responsePayload)) {
                    return responsePayload;
                } else {
                    const error = Util._createNativeError(`Response [${responseType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(responsePayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Response.${responseType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadEvent<K extends keyof TypeMapEvent>(eventType: K, eventPayload: Record<string, any>): TypeMapEvent[K] {
            let validate = g_ajv.getSchema<TypeMapEvent[K]>(`Event.${eventType}`);
            if (validate) {
                if (validate(eventPayload)) {
                    return eventPayload;
                } else {
                    const error = Util._createNativeError(`Event [${eventType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(eventPayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Event.${eventType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    }

    export namespace Client {
        export namespace Request {
            export enum Type {
                Handshake = 'Handshake',
            }
        }
    
        export type HandshakeRequest = {
            clientId: string,
        }
    
        export type HandshakeResponse = {
        }
    
    
        type TypeMapRequest = {
            'Handshake': HandshakeRequest;
        }
    
        type ResponseTypeMap = {
            'Handshake': HandshakeResponse;
        }
    
        export namespace Event {
            export enum Type {
                Ready = 'Ready',
            }
        }
    
        export type ReadyEvent = {
        }
    
    
        type TypeMapEvent = {
            'Ready': ReadyEvent;
        }
    
        export namespace Message {
            export import Type = Dsgp.Message.Type;
        };
    
        export type Message = Dsgp.Message;
        type MessageTypeMap = Dsgp.MessageTypeMap<Request.Type, Event.Type>;
    
        export function createRequest(type: Protocol.Client.Request.Type, payload: Record<string, any>): Protocol.Client.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Client.Message.Type.Request,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    payload: payload
                }
            };
        }
    
        export function createResponse(type: Protocol.Client.Request.Type, requestUuid: string, error: Protocol.Error): Protocol.Client.Message;
        export function createResponse(type: Protocol.Client.Request.Type, requestUuid: string, error: null, payload: Record<string, any>): Protocol.Client.Message;
        export function createResponse(type: Protocol.Client.Request.Type, requestUuid: string, error: Protocol.Error | null, payload?: Record<string, any>): Protocol.Client.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Client.Message.Type.Response,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    requestUuid: requestUuid,
                    error: error,
                    payload: (error === null) ? payload : null,
                }
            };
        }
    
        export function createEvent(type: Protocol.Client.Event.Type, payload: Record<string, any>): Protocol.Client.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Client.Message.Type.Event,
                uuid: Util._generateGUID(),
                body: {
                    type: type,
                    payload: payload
                }
            };
        }
    
        export function createPing(): Protocol.Client.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Client.Message.Type.Ping,
                uuid: Util._generateGUID(),
                body: {},
            };
        }
    
        export function createPong(pingUuid: string): Protocol.Client.Message {
            return {
                version: Protocol.VERSION,
                type: Protocol.Client.Message.Type.Pong,
                uuid: Util._generateGUID(),
                body: {
                    pingUuid: pingUuid,
                },
            };
        }
    
        export function createHandshakeRequest(request: Protocol.Client.HandshakeRequest) {
            return Protocol.Client.createRequest(Protocol.Client.Request.Type.Handshake, {
                clientId: request.clientId,
            });
        }
    
        export function createReadyEvent(event: Protocol.Client.ReadyEvent) {
            return Protocol.Client.createEvent(Protocol.Client.Event.Type.Ready, {
            });
        }
    
    
        export function validateMessage(message: Record<string, any>): Protocol.Client.Message {
            let validate = g_ajv.compile<Protocol.Client.Message>(Schema);
            if (validate(message)) {
                return message;
            } else {
                const error = Util._createNativeError(`Message validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(message)}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validateBodyMessage<K extends keyof MessageTypeMap>(messageType: K, messageBody: Record<string, any>): MessageTypeMap[K] {
            let validate = g_ajv.getSchema<MessageTypeMap[K]>(`Client${messageType}`);
            if (validate) {
                if (validate(messageBody)) {
                    return messageBody;
                } else {
                    const error = Util._createNativeError(`Message [${messageType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(messageBody)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [Client${messageType}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadRequest<K extends keyof TypeMapRequest>(requestType: K, requestPayload: Record<string, any>): TypeMapRequest[K] {
            let validate = g_ajv.getSchema<TypeMapRequest[K]>(`Client.Request.${requestType}`);
            if (validate) {
                if (validate(requestPayload)) {
                    return requestPayload;
                } else {
                    const error = Util._createNativeError(`Client.Request [${requestType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(requestPayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Client.Request.${requestType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadResponse<K extends keyof ResponseTypeMap>(responseType: K, responsePayload: Record<string, any>): ResponseTypeMap[K] {
            let validate = g_ajv.getSchema<ResponseTypeMap[K]>(`Client.Response.${responseType}`);
            if (validate) {
                if (validate(responsePayload)) {
                    return responsePayload;
                } else {
                    const error = Util._createNativeError(`Response [${responseType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(responsePayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Response.${responseType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    
        export function validatePayloadEvent<K extends keyof TypeMapEvent>(eventType: K, eventPayload: Record<string, any>): TypeMapEvent[K] {
            let validate = g_ajv.getSchema<TypeMapEvent[K]>(`Event.${eventType}`);
            if (validate) {
                if (validate(eventPayload)) {
                    return eventPayload;
                } else {
                    const error = Util._createNativeError(`Event [${eventType}] payload validation error [${JSON.stringify(validate.errors)}] for [${JSON.stringify(eventPayload)}]`);
                    log.error(LOG_TAG, error);
                    throw error;
                }
            } else {
                const error = Util._createNativeError(`Validation function not found for [${`Event.${eventType}`}]`);
                log.error(LOG_TAG, error);
                throw error;
            }
        }
    }
}

namespace Util {
    export function _convertErrorToMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.stack ? error.stack : error.message;
        }
        return error as string;
    }

    export function _generateGUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // TODO Add machine id to
    export function _generateUUID(): string {
        return intformat(FlakeId.next(), 'dec');
    }

    export function _createNativeError(message: string): Error {
        return new Error(message);
    }
}


export { Dsgp, Protocol, Util };
