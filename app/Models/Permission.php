<?php

namespace Pterodactyl\Models;

use Illuminate\Support\Collection;

class Permission extends Model
{
    /**
     * The resource name for this model when it is transformed into an
     * API representation using fractal.
     */
    public const RESOURCE_NAME = 'subuser_permission';

    /**
     * Constants defining different permissions available.
     */
    public const ACTION_WEBSOCKET_CONNECT = 'websocket.connect';
    public const ACTION_CONTROL_CONSOLE = 'control.console';
    public const ACTION_CONTROL_START = 'control.start';
    public const ACTION_CONTROL_STOP = 'control.stop';
    public const ACTION_CONTROL_RESTART = 'control.restart';

    public const ACTION_DATABASE_READ = 'database.read';
    public const ACTION_DATABASE_CREATE = 'database.create';
    public const ACTION_DATABASE_UPDATE = 'database.update';
    public const ACTION_DATABASE_DELETE = 'database.delete';
    public const ACTION_DATABASE_VIEW_PASSWORD = 'database.view_password';

    public const ACTION_SCHEDULE_READ = 'schedule.read';
    public const ACTION_SCHEDULE_CREATE = 'schedule.create';
    public const ACTION_SCHEDULE_UPDATE = 'schedule.update';
    public const ACTION_SCHEDULE_DELETE = 'schedule.delete';

    public const ACTION_USER_READ = 'user.read';
    public const ACTION_USER_CREATE = 'user.create';
    public const ACTION_USER_UPDATE = 'user.update';
    public const ACTION_USER_DELETE = 'user.delete';

    public const ACTION_BACKUP_READ = 'backup.read';
    public const ACTION_BACKUP_CREATE = 'backup.create';
    public const ACTION_BACKUP_DELETE = 'backup.delete';
    public const ACTION_BACKUP_DOWNLOAD = 'backup.download';
    public const ACTION_BACKUP_RESTORE = 'backup.restore';

    public const ACTION_ALLOCATION_READ = 'allocation.read';
    public const ACTION_ALLOCATION_CREATE = 'allocation.create';
    public const ACTION_ALLOCATION_UPDATE = 'allocation.update';
    public const ACTION_ALLOCATION_DELETE = 'allocation.delete';

    public const ACTION_FILE_READ = 'file.read';
    public const ACTION_FILE_READ_CONTENT = 'file.read-content';
    public const ACTION_FILE_CREATE = 'file.create';
    public const ACTION_FILE_UPDATE = 'file.update';
    public const ACTION_FILE_DELETE = 'file.delete';
    public const ACTION_FILE_ARCHIVE = 'file.archive';
    public const ACTION_FILE_SFTP = 'file.sftp';

    public const ACTION_STARTUP_READ = 'startup.read';
    public const ACTION_STARTUP_UPDATE = 'startup.update';
    public const ACTION_STARTUP_DOCKER_IMAGE = 'startup.docker-image';

    public const ACTION_SETTINGS_RENAME = 'settings.rename';
    public const ACTION_SETTINGS_REINSTALL = 'settings.reinstall';

    public const ACTION_ACTIVITY_READ = 'activity.read';

    /**
     * Should timestamps be used on this model.
     */
    public $timestamps = false;

    /**
     * The table associated with the model.
     */
    protected $table = 'permissions';

    /**
     * Fields that are not mass assignable.
     */
    protected $guarded = ['id', 'created_at', 'updated_at'];

    /**
     * Cast values to correct type.
     */
    protected $casts = [
        'subuser_id' => 'integer',
    ];

    public static array $validationRules = [
        'subuser_id' => 'required|numeric|min:1',
        'permission' => 'required|string',
    ];

    /**
     * All the permissions available on the system. You should use self::permissions()
     * to retrieve them, and not directly access this array as it is subject to change.
     *
     * @see \Pterodactyl\Models\Permission::permissions()
     */
    protected static array $permissions = [
        'websocket' => [
            'description' => '允许用户连接到实例 websocket，让他们可以访问查看控制台输出和实时实例统计信息。',
            'keys' => [
                'connect' => '允许用户连接到实例的 websocket 实例以流式传输控制台。',
            ],
        ],

        'control' => [
            'description' => '控制用户控制实例电源状态或发送命令的能力的权限。',
            'keys' => [
                'console' => '允许用户通过控制台向实例发送命令。',
                'start' => '允许用户在实例停止时启动它。',
                'stop' => '允许用户停止正在运行的实例。',
                'restart' => '允许用户执行实例重启。这允许他们在脱机时启动实例，但不会将实例置于完全停止状态。',
            ],
        ],

        'user' => [
            'description' => '允许用户管理实例上其他子用户的权限。他们将永远无法编辑自己的帐户，或分配他们自己没有的权限。',
            'keys' => [
                'create' => '允许用户为实例创建新的子用户。',
                'read' => '允许用户查看子用户及其对实例的权限。',
                'update' => '允许用户修改其他子用户。',
                'delete' => '允许用户从实例中删除子用户。',
            ],
        ],

        'file' => [
            'description' => '控制用户修改此实例文件系统能力的权限。',
            'keys' => [
                'create' => '允许用户通过面板或直接上传创建其他文件和文件夹。',
                'read' => '允许用户查看目录的内容，但不能查看或下载文件的内容。',
                'read-content' => '允许用户查看给定文件的内容。这也将允许用户下载文件。',
                'update' => '允许用户更新现有文件或目录的内容。',
                'delete' => '允许用户删除文件或目录。',
                'archive' => '允许用户压缩系统上的的文件以及解压系统上的现有压缩文件。',
                'sftp' => '允许用户使用其他分配的文件权限连接到 SFTP 并管理实例文件。',
            ],
        ],

        'backup' => [
            'description' => '控制用户创建和管理实例备份的能力的权限。',
            'keys' => [
                'create' => '允许用户为此实例创建新备份。',
                'read' => '允许用户查看此实例存在的所有备份。',
                'delete' => '允许用户从系统中删除备份。',
                'download' => '允许用户下载实例的备份。这是个危险权限：这允许用户访问备份中实例的所有文件。',
                'restore' => '允许用户恢复实例的备份。这是个危险权限：这允许用户删除实例中的所有实例文件。',
            ],
        ],

        // Controls permissions for editing or viewing a server's allocations.
        'allocation' => [
            'description' => '控制用户修改此实例端口分配能力的权限。',
            'keys' => [
                'read' => '允许用户查看当前分配给该实例的所有分配。对该实例具有任何访问级别的用户始终可以查看主要分配。',
                'create' => '允许用户向实例创建额外的分配。',
                'update' => '允许用户更改主实例分配并将注释附加到每个分配。',
                'delete' => '允许用户从实例中删除分配。',
            ],
        ],

        // Controls permissions for editing or viewing a server's startup parameters.
        'startup' => [
            'description' => '控制用户查看此实例启动参数的能力的权限。',
            'keys' => [
                'read' => '允许用户查看实例的启动变量。',
                'update' => '允许用户修改实例的启动变量。',
                'docker-image' => '允许用户修改运行实例时使用的 Docker 镜像。',
            ],
        ],

        'database' => [
            'description' => '控制用户访问此实例的数据库管理的权限。',
            'keys' => [
                'create' => '允许用户为此实例创建新数据库。',
                'read' => '允许用户查看与此实例关联的数据库。',
                'update' => '允许用户重置数据库实例的密码。如果用户没有 view_password 权限，他们将看不到更新的密码。',
                'delete' => '允许用户从此实例中删除数据库实例。',
                'view_password' => '允许用户查看与此实例的数据库实例关联的密码。',
            ],
        ],

        'schedule' => [
            'description' => '控制用户访问此实例计划系统的权限。',
            'keys' => [
                'create' => '允许用户为此实例创建新计划。', // task.create-schedule
                'read' => '允许用户查看此实例的计划和与其关联的任务。', // task.view-schedule, task.list-schedules
                'update' => '允许用户更新此实例的计划和计划中的任务。', // task.edit-schedule, task.queue-schedule, task.toggle-schedule
                'delete' => '允许用户删除此实例的计划。', // task.delete-schedule
            ],
        ],

        'settings' => [
            'description' => '控制用户访问此实例设置的权限。',
            'keys' => [
                'rename' => '允许用户重命名此实例并更改其描述。',
                'reinstall' => '允许用户触发重新安装此实例。',
            ],
        ],

        'activity' => [
            'description' => '控制用户对实例活动日志的访问的权限。',
            'keys' => [
                'read' => '允许用户查看实例的活动日志。',
            ],
        ],
    ];

    /**
     * Returns all the permissions available on the system for a user to
     * have when controlling a server.
     */
    public static function permissions(): Collection
    {
        return Collection::make(self::$permissions);
    }
}
