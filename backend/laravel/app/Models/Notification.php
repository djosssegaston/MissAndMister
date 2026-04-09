<?php

namespace App\Models;

use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notification extends DatabaseNotification
{
    use SoftDeletes;

    protected $fillable = [
        'notifiable_id',
        'notifiable_type',
        'type',
        'title',
        'body',
        'data',
        'read_at',
        'status',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function notifiable()
    {
        return $this->morphTo();
    }
}
