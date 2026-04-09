<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FraudReport extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'vote_id',
        'ip_address',
        'score',
        'reason',
        'status',
        'signals',
    ];

    protected $casts = [
        'signals' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vote()
    {
        return $this->belongsTo(Vote::class);
    }
}
