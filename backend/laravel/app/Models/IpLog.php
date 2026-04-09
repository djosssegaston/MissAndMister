<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IpLog extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'ip_address',
        'action',
        'meta',
        'status',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
