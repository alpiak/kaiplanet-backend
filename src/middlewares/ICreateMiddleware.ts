import { Handler } from "express";

export default interface ICreateMiddleware {
    createMiddleware(): Handler;
}
