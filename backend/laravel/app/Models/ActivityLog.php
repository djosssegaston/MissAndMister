<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ActivityLog extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'causer_id',
        'causer_type',
        'subject_id',
        'subject_type',
        'action',
        'ip_address',
        'meta',
        'status',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function causer()
    {
        return $this->morphTo();
    }

    public function subject()
    {
        return $this->morphTo();
    }
}
