<?php

namespace Pterodactyl\Exceptions\Http\Server;

use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ServerStateConflictException extends ConflictHttpException
{
    /**
     * Exception thrown when the server is in an unsupported state for API access or
     * certain operations within the codebase.
     */
    public function __construct(Server $server, ?\Throwable $previous = null)
    {
        $message = '此实例目前处于不受支持的状态，请稍后再试。';
        if ($server->isSuspended()) {
            $message = '此实例已被冻结，请求的功能不可用。';
        } elseif ($server->node->isUnderMaintenance()) {
            $message = '此实例的节点目前正在维护中，请求的功能不可用。';
        } elseif (!$server->isInstalled()) {
            $message = '此实例尚未完成安装过程，请稍后再试。';
        } elseif ($server->status === Server::STATUS_RESTORING_BACKUP) {
            $message = '此实例当前正在从备份中恢复，请稍后再试。';
        } elseif (!is_null($server->transfer)) {
            $message = '此实例目前正在转移到新主机上，请稍后再试。';
        }

        parent::__construct($message, $previous);
    }
}
