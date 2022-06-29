import fastify, { FastifyInstance } from 'fastify';
import fastifyIO from 'fastify-socket.io'
import { Protocol, Util, Dsgp } from '../../protocol/protocol';

const LOG_TAG = 'Server';

// class Services extends Protocol.Server. {
//
// }

class Server {
    private _port: number;
    private _fastify: FastifyInstance;

    constructor(options: { port: number }) {
        this._port = options.port;

        this._fastify = fastify();
        this._fastify.register(fastifyIO);

        this._fastify.ready(() => {
            this._fastify.io.on("connection", (socket) => {
     
                socket.on("message", (message) => {
                    const uuid = Util._generateGUID();
                    let response: any;
                    switch (message.type) {
                        case Protocol.Client.Message.Type.Ping:
                            response = Protocol.Server.createPong(uuid);
                            break;
                        case Protocol.Client.Message.Type.Request:

                            response = Protocol.Client.createResponse(
                                Protocol.Client.Request.Type.Handshake,
                                message.uuid,
                                null,
                                {},
                            );
                    }

                    socket.emit("message", response)
                })
            })
        })
    }

    async run(): Promise<void> {
        try {
            const address = await this._fastify.listen({ port: this._port });
            console.info(LOG_TAG, `Server is listening on [${address}]`);
        } catch (e) {
            console.error(LOG_TAG, e);
            throw new Error(`Server listen error [${e}]`);
        }
    }

    async shutdown(): Promise<void> {
        await this._fastify.close();
        console.info(`Server closed on port [${this._port}]`);
    }
}

export { Server };
