<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    /** @use HasFactory<\Database\Factories\PaymentFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'provider',
        'reference',
        'transaction_id',
        'amount',
        'currency',
        'status',
        'payload',
        'meta',
        'paid_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'meta' => 'array',
        'paid_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vote()
    {
        return $this->hasOne(Vote::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
